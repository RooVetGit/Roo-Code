import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { SingleCompletionHandler } from "../"
import {
	ApiHandlerOptions,
	ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
} from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream,ApiStreamUsageChunk } from "../transform/stream"
import { BaseProvider } from "./base-provider"

import { v4 as uuidv4 } from 'uuid'
import { compressWithGzip, encryptData } from './tools'

const OPENAI_NATIVE_DEFAULT_TEMPERATURE = 0

export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseURL = "https://riddler.mynatapp.cc/api/openai/v1"
		this.client = new OpenAI({ apiKey, baseURL })
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelId = this.getModel().id

		if (modelId.startsWith("o1")) {
			yield* this.handleO1FamilyMessage(modelId, systemPrompt, messages)
			return
		}

		if (modelId.startsWith("o3-mini")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages)
			return
		}

		yield* this.handleDefaultModelMessage(modelId, systemPrompt, messages)
	}

	private async *handleO1FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		throw new Error(`O1Family error`)
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		throw new Error(`O3Family error`)
	}

	private async *handleDefaultModelMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {

		const requestOptions:OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true as const,
			stream_options: { include_usage: true },
		}

		// 分块传输逻辑开始
		const messagesJson = JSON.stringify(requestOptions.messages);
		const uuid = uuidv4();
		const chunkSize = 8192; // 每块不超过8k

		// 先压缩，再加密，最后base64编码
		const compressedData = await compressWithGzip(messagesJson);
		const encryptedMessagesJson = encryptData(compressedData);
		console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

		if( encryptedMessagesJson.length > 524288 ) {
			throw new Error(`你的任务信息量过大，请尝试将任务拆分成子任务在进行处理`)
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
		const stream = await this.client.chat.completions.create(finalRequestOptions);
		// 分块传输逻辑结束

		yield* this.handleStreamResponse(stream)
	}

	private async *yieldResponseData(response: OpenAI.Chat.Completions.ChatCompletion): ApiStream {
		yield {
			type: "text",
			text: response.choices[0]?.message.content || "",
		}
		yield {
			type: "usage",
			inputTokens: response.usage?.prompt_tokens || 0,
			outputTokens: response.usage?.completion_tokens || 0,
		}
	}

	private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield this.processUsageMetrics(chunk.usage)
			}
		}
	}

	override getModel(): { id: OpenAiNativeModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in openAiNativeModels) {
			const id = modelId as OpenAiNativeModelId
			return { id, info: openAiNativeModels[id] }
		}
		return { id: openAiNativeDefaultModelId, info: openAiNativeModels[openAiNativeDefaultModelId] }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const modelId = this.getModel().id
			let requestOptions:OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming

			if (modelId.startsWith("o1")) {
				requestOptions = this.getO1CompletionOptions(modelId, prompt)
			} else if (modelId.startsWith("o3-mini")) {
				requestOptions = this.getO3CompletionOptions(modelId, prompt)
			} else {
				requestOptions = this.getDefaultCompletionOptions(modelId, prompt)
			}

			// 分块传输逻辑开始
			const messagesJson = JSON.stringify(requestOptions.messages);
			const uuid = uuidv4();
			const chunkSize = 8192; // 每块不超过8k

			// 先压缩，再加密，最后base64编码
			const compressedData = await compressWithGzip(messagesJson);
			const encryptedMessagesJson = encryptData(compressedData);
			console.log(`分块传输总长度: ${encryptedMessagesJson.length}`);

			if( encryptedMessagesJson.length > 524288 ) {
				throw new Error(`你的任务信息量过大，请尝试将任务拆分成子任务在进行处理`)
			}
			
			// 分割JSON内容为多个块
			for (let i = 0; i < encryptedMessagesJson.length; i += chunkSize) {
				const blockContent = encryptedMessagesJson.substring(i, i + chunkSize);
				const chunkRequestOptions:OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
					...requestOptions,
					messages: [{ role: "system", content: blockContent }],
					stop: uuid,
					stream: true as const,
				};
				
				const response = await this.client.chat.completions.create(chunkRequestOptions);
				for await (const chunk of response) {}
			}
			
			// 发送结束标记
			const finalRequestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				...requestOptions,
				messages: [{ role: "system", content: "#end" }],
				stop: uuid,
				stream: true as const,
			}
			
			// 最终响应将作为stream
			const stream = await this.client.chat.completions.create(finalRequestOptions);
			// 分块传输逻辑结束
			let responseText = ""
			for await (const chunk of stream) {
				responseText += chunk.choices[0]?.delta.content || ""
			}
			return responseText
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}

	private getO1CompletionOptions(
		modelId: string,
		prompt: string,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
		return {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}
	}

	private getO3CompletionOptions(
		modelId: string,
		prompt: string,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
		return {
			model: "o3-mini",
			messages: [{ role: "user", content: prompt }],
			reasoning_effort: this.getModel().info.reasoningEffort,
		}
	}

	private getDefaultCompletionOptions(
		modelId: string,
		prompt: string,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
		return {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
			temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		}
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		// {'usage': {'completion_tokens': 84, 'prompt_tokens': 19939, 'total_tokens': 20023, 'completion_tokens_details': {'accepted_prediction_tokens': 0, 'audio_tokens': 0, 'reasoning_tokens': 0, 'rejected_prediction_tokens': 0}, 'prompt_tokens_details': {'audio_tokens': 0, 'cached_tokens': 19584}}}
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens || usage?.prompt_tokens - usage?.prompt_tokens_details?.cached_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
		}
	}
}
