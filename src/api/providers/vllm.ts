import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, openAiModelInfoSaneDefaults } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/**
 * vLLM Provider for on-premises LLM deployments
 *
 * Supports vLLM deployment with OpenAI-compatible API
 * Default URL: http://localhost:8000/v1
 *
 * Example usage:
 * - Single GPU: http://localhost:8000/v1/chat/completions
 * - Multi-node: http://gpu-srv:1234/v1/chat/completions
 */
export class VLLMHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// vLLM 기본 URL 처리 - /v1 suffix 확인
		let baseURL = (options as any).vllmBaseUrl || "http://localhost:8000"
		if (!baseURL.endsWith("/v1")) {
			baseURL = baseURL.replace(/\/$/, "") + "/v1"
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey || "vllm",
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const stream = await this.client.chat.completions.create({
			model: this.getModel().id,
			messages: openAiMessages,
			temperature: this.options.modelTemperature ?? 0.7,
			stream: true,
			stream_options: { include_usage: true },
		})

		let lastUsage: OpenAI.Chat.Completions.ChatCompletionChunk["usage"] | undefined
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield {
				type: "usage",
				inputTokens: lastUsage?.prompt_tokens || 0,
				outputTokens: lastUsage?.completion_tokens || 0,
			}
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		return {
			id: (this.options as any).vllmModelId || "llama-2-7b-chat",
			info: openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const response = await this.client.chat.completions.create({
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? 0.7,
				stream: false,
			})
			return response.choices[0]?.message.content || ""
		} catch (error) {
			throw new Error(`vLLM completion error: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * vLLM 연결 상태 확인
	 */
	public async validateConnection(): Promise<boolean> {
		try {
			const baseURL = this.client.baseURL
			const response = await fetch(`${baseURL}/models`, {
				headers: {
					...(this.options.apiKey && { Authorization: `Bearer ${this.options.apiKey}` }),
				},
			})
			return response.ok
		} catch (error) {
			console.warn(`vLLM connection validation failed: ${error}`)
			return false
		}
	}
}
