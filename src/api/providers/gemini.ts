import { RiddlerHandler, RiddlerHandlerOptions } from "./riddler"
import { Anthropic } from "@anthropic-ai/sdk"
import { geminiModels, geminiDefaultModelId, ModelInfo, GeminiModelId } from "../../shared/api"
import { ApiStreamUsageChunk,ApiStream } from "../transform/stream" // Import for type
import { getModelParams } from "../index"
import { info } from "node:console"

export class GeminiHandler extends RiddlerHandler {
	constructor(options: RiddlerHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.geminiApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? geminiDefaultModelId,
			openAiBaseUrl: "https://riddler.mynatapp.cc/api/gemini/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		let id = this.options.apiModelId ? (this.options.apiModelId as GeminiModelId) : geminiDefaultModelId
		let info: ModelInfo = geminiModels[id]

		if (id?.endsWith(":thinking")) {
			id = id.slice(0, -":thinking".length) as GeminiModelId

			if (geminiModels[id]) {
				info = geminiModels[id]

				return {
					id,
					info,
					thinkingConfig: this.options.modelMaxThinkingTokens
						? { thinkingBudget: this.options.modelMaxThinkingTokens }
						: undefined,
					maxOutputTokens: this.options.modelMaxTokens ?? info.maxTokens ?? undefined,
				}
			}
		}

		if (!info) {
			id = geminiDefaultModelId
			info = geminiModels[geminiDefaultModelId]
		}

		return { id, info }
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const thinkingConfig = this.getModel().thinkingConfig
		yield* super.createMessage(systemPrompt, messages, {...thinkingConfig})
	}

	// Override to handle Gemini's usage metrics, including caching.
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
