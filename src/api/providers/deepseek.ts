import { deepSeekModels, deepSeekDefaultModelId } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk, ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import type { ApiHandlerCreateMessageMetadata } from "../index"

import { OpenAiHandler } from "./openai"

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Get the stream from the parent class
		const stream = super.createMessage(systemPrompt, messages, metadata)

		// Process each chunk to remove unwanted characters
		for await (const chunk of stream) {
			if (chunk.type === "text" && chunk.text) {
				// Sanitize the text content
				chunk.text = this.sanitizeContent(chunk.text)
			} else if (chunk.type === "reasoning" && chunk.text) {
				// Also sanitize reasoning content
				chunk.text = this.sanitizeContent(chunk.text)
			}
			yield chunk
		}
	}

	/**
	 * Removes unwanted "极速模式" (speed mode) characters from the content.
	 * These characters appear to be injected by some DeepSeek V3.1 configurations,
	 * possibly from a Chinese language interface or prompt template.
	 * The sanitization preserves legitimate Chinese text while removing these artifacts.
	 */
	private sanitizeContent(content: string): string {
		// First, try to remove the complete phrase "极速模式"
		let sanitized = content.replace(/极速模式/g, "")

		// Remove partial sequences like "模式" that might remain
		sanitized = sanitized.replace(/模式(?![一-龿])/g, "")

		// Remove isolated occurrences of these characters when they appear
		// between non-Chinese characters or at boundaries
		// Using more specific patterns to avoid removing legitimate Chinese text
		sanitized = sanitized.replace(/(?<![一-龿])极(?![一-龿])/g, "")
		sanitized = sanitized.replace(/(?<![一-龿])速(?![一-龿])/g, "")
		sanitized = sanitized.replace(/(?<![一-龿])模(?![一-龿])/g, "")
		sanitized = sanitized.replace(/(?<![一-龿])式(?![一-龿])/g, "")

		// Handle cases where these characters appear with spaces
		sanitized = sanitized.replace(/\s+极\s*/g, " ")
		sanitized = sanitized.replace(/\s+速\s*/g, " ")
		sanitized = sanitized.replace(/\s+模\s*/g, " ")
		sanitized = sanitized.replace(/\s+式\s*/g, " ")

		// Clean up any resulting multiple spaces
		sanitized = sanitized.replace(/\s+/g, " ").trim()

		return sanitized
	}

	// Override to handle DeepSeek's usage metrics, including caching.
	protected override processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}
}
