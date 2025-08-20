import type { ModelInfo } from "../model.js"

// Featherless AI models - https://api.featherless.ai/v1/models
export type FeatherlessModelId = keyof typeof featherlessModels

export const featherlessDefaultModelId: FeatherlessModelId = "meta-llama/Meta-Llama-3.1-8B-Instruct"

export const featherlessModels = {
	"meta-llama/Meta-Llama-3.1-8B-Instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.1,
		description: "Meta's Llama 3.1 8B Instruct model with 128K context window",
	},
	"meta-llama/Meta-Llama-3.1-70B-Instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.4,
		description: "Meta's Llama 3.1 70B Instruct model with 128K context window",
	},
	"meta-llama/Meta-Llama-3.1-405B-Instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 2.0,
		description: "Meta's largest Llama 3.1 405B Instruct model with 128K context window",
	},
	"Qwen/Qwen2.5-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.4,
		description: "Alibaba's Qwen 2.5 72B Instruct model with 128K context window",
	},
	"mistralai/Mistral-7B-Instruct-v0.3": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.1,
		description: "Mistral's 7B Instruct v0.3 model with 32K context window",
	},
	"mistralai/Mixtral-8x7B-Instruct-v0.1": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.3,
		description: "Mistral's Mixtral 8x7B MoE Instruct model with 32K context window",
	},
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.05,
		outputPrice: 0.05,
		description: "DeepSeek R1 Distill Qwen 1.5B model with 128K context window",
	},
	"moonshotai/Kimi-K2-Instruct": {
		maxTokens: 16384,
		contextWindow: 16384,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.3,
		description: "Moonshot AI's Kimi K2 Instruct model with tool use support",
	},
} as const satisfies Record<string, ModelInfo>
