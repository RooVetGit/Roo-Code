import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"

import {
	ApiHandlerOptions,
	azureOpenAiDefaultApiVersion,
	ModelInfo,
	openAiModelInfoSaneDefaults,
} from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { ApiStream, ApiStreamChunk } from "../transform/stream"

export class OpenAiHandler implements ApiHandler, SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		// Azure API shape slightly differs from the core API shape:
		// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
		const urlHost = new URL(this.options.openAiBaseUrl ?? "").host
		if (urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure) {
			this.client = new AzureOpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
			})
		} else {
			this.client = new OpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
			})
		}
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelInfo = this.getModel().info
		const modelId = this.options.openAiModelId ?? ""

		const deepseekReasoner = modelId.includes("deepseek-reasoner")
		const thinkingParser = modelInfo.thinkTokensInResponse
			? new ThinkingTokenSeparator()
			: new PassThroughTokenSeparator()

		if (this.options.openAiStreamingEnabled ?? true) {
			const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
				role: "system",
				content: systemPrompt,
			}
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				temperature: 0,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: [systemMessage, ...convertToOpenAiMessages(messages)],
				stream: true as const,
				stream_options: { include_usage: true },
			}
			if (this.options.includeMaxTokens) {
				requestOptions.max_tokens = modelInfo.maxTokens
			}

			const stream = await this.client.chat.completions.create(requestOptions)

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta ?? {}

				if (delta.content) {
					for (const parsedChunk of thinkingParser.parseChunk(delta.content)) {
						yield parsedChunk
					}
				}

				if ("reasoning_content" in delta && delta.reasoning_content) {
					yield {
						type: "reasoning",
						text: (delta.reasoning_content as string | undefined) || "",
					}
				}
				if (chunk.usage) {
					yield {
						type: "usage",
						inputTokens: chunk.usage.prompt_tokens || 0,
						outputTokens: chunk.usage.completion_tokens || 0,
					}
				}
			}

			for (const parsedChunk of thinkingParser.flush()) {
				yield parsedChunk
			}
		} else {
			// o1 for instance doesnt support streaming, non-1 temp, or system prompt
			const systemMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
				role: "user",
				content: systemPrompt,
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: [systemMessage, ...convertToOpenAiMessages(messages)],
			}

			const response = await this.client.chat.completions.create(requestOptions)

			for (const parsedChunk of thinkingParser.parseChunk(response.choices[0]?.message.content || "", true)) {
				yield parsedChunk
			}
			yield {
				type: "usage",
				inputTokens: response.usage?.prompt_tokens || 0,
				outputTokens: response.usage?.completion_tokens || 0,
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}
			throw error
		}
	}
}

class PassThroughTokenSeparator {
	public parseChunk(chunk: string): ApiStreamChunk[] {
		return [{ type: "text", text: chunk }]
	}

	public flush(): ApiStreamChunk[] {
		return []
	}
}
class ThinkingTokenSeparator {
	private insideThinking = false
	private buffer = ""

	public parseChunk(chunk: string, flush: boolean = false): ApiStreamChunk[] {
		let parsed: ApiStreamChunk[] = []
		chunk = this.buffer + chunk
		this.buffer = ""

		const parseTag = (tag: string, thinking: boolean) => {
			if (chunk.indexOf(tag) !== -1) {
				const [before, after] = chunk.split(tag)
				if (before.length > 0) {
					parsed.push({ type: thinking ? "text" : "reasoning", text: before })
				}
				chunk = after
				this.insideThinking = thinking
			} else if (this.endsWithIncompleteString(chunk, tag)) {
				this.buffer = chunk
				chunk = ""
			}
		}

		if (!this.insideThinking) {
			parseTag("<think>", true)
		}
		if (this.insideThinking) {
			parseTag("</think>", false)
		}

		if (flush) {
			chunk = this.buffer + chunk
			this.buffer = ""
		}

		if (chunk.length > 0) {
			parsed.push({ type: this.insideThinking ? "reasoning" : "text", text: chunk })
		}

		return parsed
	}

	private endsWithIncompleteString(chunk: string, str: string): boolean {
		// iterate from end of the str and check if we start matching from any point
		for (let i = str.length - 1; i >= 1; i--) {
			if (chunk.endsWith(str.slice(0, i))) {
				return true
			}
		}
		return false
	}

	public flush(): ApiStreamChunk[] {
		return this.parseChunk("", true)
	}
}
