import { OpenAiHandler } from "./openai"
import { deepSeekModels, deepSeekDefaultModelId } from "../../shared"
import { getModelParams } from "../index"
export class DeepSeekHandler extends OpenAiHandler {
	constructor(options) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}
	getModel() {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[modelId] || deepSeekModels[deepSeekDefaultModelId]
		return {
			id: modelId,
			info,
			...getModelParams({ options: this.options, model: info }),
		}
	}
	// Override to handle DeepSeek's usage metrics, including caching.
	processUsageMetrics(usage) {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}
}
//# sourceMappingURL=deepseek.js.map
