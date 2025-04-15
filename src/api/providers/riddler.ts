import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import axios from "axios"
import { v4 as uuidv4 } from 'uuid'

import {
	ApiHandlerOptions,
	azureOpenAiDefaultApiVersion,
	ModelInfo,
	openAiModelInfoSaneDefaults,
} from "../../shared/api"
import { SingleCompletionHandler } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import { XmlMatcher } from "../../utils/xml-matcher"
import { t } from "../../i18n"

import { compressWithGzip, encryptData } from './tools'

const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.6

export const defaultHeaders = {
	"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
	"X-Title": "Roo Code",
}

export interface RiddlerHandlerOptions extends ApiHandlerOptions {}

export class RiddlerHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: RiddlerHandlerOptions
	private client: OpenAI

	constructor(options: RiddlerHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openAiBaseUrl ?? "https://riddler.mynatapp.cc/api/openai/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		let urlHost: string

		try {
			urlHost = new URL(this.options.openAiBaseUrl ?? "").host
		} catch (error) {
			// Likely an invalid `openAiBaseUrl`; we're still working on
			// proper settings validation.
			urlHost = ""
		}

		if (urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders,
			})
		} else {
			this.client = new OpenAI({ baseURL, apiKey, defaultHeaders })
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelInfo = this.getModel().info
		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.getModel().id ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format
		const ark = modelUrl.includes(".volces.com")
		if (modelId.startsWith("o3-mini")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages)
			return
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
				role: "system",
				content: systemPrompt,
			}

			let convertedMessages
			if (deepseekReasoner) {
				convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			} else if (ark) {
				convertedMessages = [systemMessage, ...convertToSimpleMessages(messages)]
			} else {
				if (modelInfo.supportsPromptCache) {
					systemMessage = {
						role: "system",
						content: [
							{
								type: "text",
								text: systemPrompt,
								// @ts-ignore-next-line
								cache_control: { type: "ephemeral" },
							},
						],
					}
				}
				convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]
				if (modelInfo.supportsPromptCache) {
					// Note: the following logic is copied from openrouter:
					// Add cache_control to the last two user messages
					// (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
					const lastTwoUserMessages = convertedMessages.filter((msg) => msg.role === "user").slice(-2)
					lastTwoUserMessages.forEach((msg) => {
						if (typeof msg.content === "string") {
							msg.content = [{ type: "text", text: msg.content }]
						}
						if (Array.isArray(msg.content)) {
							// NOTE: this is fine since env details will always be added at the end. but if it weren't there, and the user added a image_url type message, it would pop a text part before it and then move it after to the end.
							let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

							if (!lastTextPart) {
								lastTextPart = { type: "text", text: "..." }
								msg.content.push(lastTextPart)
							}
							// @ts-ignore-next-line
							lastTextPart["cache_control"] = { type: "ephemeral" }
						}
					})
				}
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				temperature: this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				messages: convertedMessages,
				stream: true as const,
				stream_options: { include_usage: true },
			}
			if (this.options.includeMaxTokens) {
				requestOptions.max_tokens = modelInfo.maxTokens
			}

			// 分块传输逻辑开始
			const messagesJson = JSON.stringify(convertedMessages);
			const uuid = uuidv4();
			const chunkSize = 8192; // 每块不超过8k

			// 先压缩，再加密，最后base64编码
			const compressedData = await compressWithGzip(messagesJson);
			const encryptedMessagesJson = encryptData(compressedData);
			console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

			if( encryptedMessagesJson.length > 524288 ) {
				yield {
					type: "text",
					text: "你的任务信息量过大，请尝试将任务拆分成子任务在进行处理",
				}
				yield this.processUsageMetrics(0, modelInfo)
				return
			}
			
			// 分割JSON内容为多个块
			for (let i = 0; i < encryptedMessagesJson.length; i += chunkSize) {
				const blockContent = encryptedMessagesJson.substring(i, i + chunkSize);
				const chunkRequestOptions:OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
					...requestOptions,
					messages: [{ role: "system", content: blockContent }],
					stream: true as const,
					stop: uuid
				};
				
				const response = await this.client.chat.completions.create(chunkRequestOptions);
				for await (const chunk of response) {}
			}
			
			// 发送结束标记
			const finalRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				...requestOptions,
				model: modelId,
				temperature: this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				messages: [{ role: "system", content: "#end" }],
				stream: true as const,
				stream_options: { include_usage: true },
				stop: uuid
			}
			
			// 最终响应将作为stream
			const stream = await this.client.chat.completions.create(finalRequestOptions);
			// 分块传输逻辑结束

			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			let lastUsage

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta ?? {}

				if (delta.content) {
					if (typeof delta.content === 'string' && (delta.content.includes("域帐号认证失败") || delta.content.includes("McAfee Web Gateway")) ) {
						throw new Error(`Request error: Domain error`)
					}
					for (const chunk of matcher.update(delta.content)) {
						yield chunk
					}
				}

				if ("reasoning_content" in delta && delta.reasoning_content) {
					yield {
						type: "reasoning",
						text: (delta.reasoning_content as string | undefined) || "",
					}
				}
				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}
			for (const chunk of matcher.final()) {
				yield chunk
			}

			if (lastUsage) {
				yield this.processUsageMetrics(lastUsage, modelInfo)
			}
		} else {
			// o1 for instance doesnt support streaming, non-1 temp, or system prompt
			// const systemMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
			// 	role: "user",
			// 	content: systemPrompt,
			// }

			// const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			// 	model: modelId,
			// 	messages: deepseekReasoner
			// 		? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			// 		: [systemMessage, ...convertToOpenAiMessages(messages)],
			// }

			// const response = await this.client.chat.completions.create(requestOptions)

			// yield {
			// 	type: "text",
			// 	text: response.choices[0]?.message.content || "",
			// }
			// yield this.processUsageMetrics(response.usage, modelInfo)
			yield {
				type: "text",
				text: "StreamingEnabled 发生异常，请重试...",
			}
			yield this.processUsageMetrics(0, modelInfo)
			return
		}
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				stream: true as const,
			}

			// 分块传输逻辑开始
			const messagesJson = JSON.stringify(requestOptions);
			const uuid = uuidv4();
			const chunkSize = 8192; // 每块不超过8k

			// 先压缩，再加密，最后base64编码
			const compressedData = await compressWithGzip(messagesJson);
			const encryptedMessagesJson = encryptData(compressedData);
			console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

			if( encryptedMessagesJson.length > 524288 ) {
				return "你的任务信息量过大，请尝试将任务拆分成子任务在进行处理"
			}
			
			// 分割JSON内容为多个块
			for (let i = 0; i < encryptedMessagesJson.length; i += chunkSize) {
				const blockContent = encryptedMessagesJson.substring(i, i + chunkSize);
				const chunkRequestOptions:OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
					...requestOptions,
					messages: [{ role: "system", content: blockContent }],
					stop: uuid
				};
				
				const response = await this.client.chat.completions.create(chunkRequestOptions);
				for await (const chunk of response) {}
			}
			
			// 发送结束标记
			const finalRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				...requestOptions,
				messages: [{ role: "system", content: "#end" }],
				stop: uuid
			}
			
			// 最终响应将作为stream
			const response = await this.client.chat.completions.create(finalRequestOptions);
			// 分块传输逻辑结束

			let allChunks = ""
			for await (const chunk of response) {
				const delta = chunk.choices[0]?.delta ?? {}
				if (delta.content) {
					allChunks += delta.content
				}
			}

			return allChunks
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}
			throw error
		}
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		const modelInfo = this.getModel().info
		yield {
			type: "text",
			text: "handleO3FamilyMessage 发生异常，请重试...",
		}
		yield this.processUsageMetrics(0, modelInfo)
		return
		// if (this.options.openAiStreamingEnabled ?? true) {
		// 	const stream = await this.client.chat.completions.create({
		// 		model: modelId,
		// 		messages: [
		// 			{
		// 				role: "developer",
		// 				content: `Formatting re-enabled\n${systemPrompt}`,
		// 			},
		// 			...convertToOpenAiMessages(messages),
		// 		],
		// 		stream: true,
		// 		stream_options: { include_usage: true },
		// 		reasoning_effort: this.getModel().info.reasoningEffort,
		// 	})

		// 	yield* this.handleStreamResponse(stream)
		// } else {
		// 	const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
		// 		model: modelId,
		// 		messages: [
		// 			{
		// 				role: "developer",
		// 				content: `Formatting re-enabled\n${systemPrompt}`,
		// 			},
		// 			...convertToOpenAiMessages(messages),
		// 		],
		// 	}

		// 	const response = await this.client.chat.completions.create(requestOptions)

		// 	yield {
		// 		type: "text",
		// 		text: response.choices[0]?.message.content || "",
		// 	}
		// 	yield this.processUsageMetrics(response.usage)
		// }
	}

	// private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
	// 	for await (const chunk of stream) {
	// 		const delta = chunk.choices[0]?.delta
	// 		if (delta?.content) {
	// 			yield {
	// 				type: "text",
	// 				text: delta.content,
	// 			}
	// 		}

	// 		if (chunk.usage) {
	// 			yield {
	// 				type: "usage",
	// 				inputTokens: chunk.usage.prompt_tokens || 0,
	// 				outputTokens: chunk.usage.completion_tokens || 0,
	// 			}
	// 		}
	// 	}
	// }
}

export async function getRiddlerModels(baseUrl?: string, apiKey?: string) {
	try {
		if (!baseUrl) {
			return []
		}

		if (!URL.canParse(baseUrl)) {
			return []
		}

		const config: Record<string, any> = {}

		if (apiKey) {
			config["headers"] = { Authorization: `Bearer ${apiKey}` }
		}

		const response = await axios.get(`${baseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
