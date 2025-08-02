import type { ModelInfo } from "../model.js"

// https://creator.poe.com/docs/external-applications/openai-compatible-api
export type PoeModelId =
	| "gpt-4o"
	| "gpt-4o-mini"
	| "o1-preview"
	| "o1-mini"
	| "claude-3-5-sonnet"
	| "claude-3-5-haiku"
	| "claude-3-opus"
	| "claude-3-sonnet"
	| "claude-3-haiku"
	| "gemini-1.5-pro"
	| "gemini-1.5-flash"
	| "gemini-2.0-flash-exp"
	| "llama-3.1-405b"
	| "llama-3.1-70b"
	| "llama-3.1-8b"
	| "llama-3.3-70b"
	| "mistral-large"
	| "grok-2"
	| "grok-2-mini"
	| "kimi-k1.5"
	| "glm-4-plus"
	| string // Allow custom bot names

export const poeDefaultModelId: PoeModelId = "claude-3-5-sonnet"

export const poeModels = {
	// GPT Models
	"gpt-4o": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2.5,
		outputPrice: 10,
		description: "OpenAI GPT-4o model via Poe",
	},
	"gpt-4o-mini": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description: "OpenAI GPT-4o Mini model via Poe",
	},
	"o1-preview": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 15,
		outputPrice: 60,
		description: "OpenAI o1-preview reasoning model via Poe",
	},
	"o1-mini": {
		maxTokens: 65536,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 12,
		description: "OpenAI o1-mini reasoning model via Poe",
	},
	// Claude Models
	"claude-3-5-sonnet": {
		maxTokens: 8192,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 15,
		description: "Anthropic Claude 3.5 Sonnet model via Poe",
	},
	"claude-3-5-haiku": {
		maxTokens: 8192,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 4,
		description: "Anthropic Claude 3.5 Haiku model via Poe",
	},
	"claude-3-opus": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 15,
		outputPrice: 75,
		description: "Anthropic Claude 3 Opus model via Poe",
	},
	"claude-3-sonnet": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 15,
		description: "Anthropic Claude 3 Sonnet model via Poe",
	},
	"claude-3-haiku": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.25,
		outputPrice: 1.25,
		description: "Anthropic Claude 3 Haiku model via Poe",
	},
	// Gemini Models
	"gemini-1.5-pro": {
		maxTokens: 8192,
		contextWindow: 2097152,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2.5,
		outputPrice: 10,
		description: "Google Gemini 1.5 Pro model via Poe",
	},
	"gemini-1.5-flash": {
		maxTokens: 8192,
		contextWindow: 1048576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.075,
		outputPrice: 0.3,
		description: "Google Gemini 1.5 Flash model via Poe",
	},
	"gemini-2.0-flash-exp": {
		maxTokens: 8192,
		contextWindow: 1048576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "Google Gemini 2.0 Flash Experimental model via Poe",
	},
	// Llama Models
	"llama-3.1-405b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.7,
		outputPrice: 2.7,
		description: "Meta Llama 3.1 405B model via Poe",
	},
	"llama-3.1-70b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.88,
		outputPrice: 0.88,
		description: "Meta Llama 3.1 70B model via Poe",
	},
	"llama-3.1-8b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.18,
		outputPrice: 0.18,
		description: "Meta Llama 3.1 8B model via Poe",
	},
	"llama-3.3-70b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.88,
		outputPrice: 0.88,
		description: "Meta Llama 3.3 70B model via Poe",
	},
	// Other Models
	"mistral-large": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2,
		outputPrice: 6,
		description: "Mistral Large model via Poe",
	},
	"grok-2": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 5,
		outputPrice: 10,
		description: "xAI Grok-2 model via Poe",
	},
	"grok-2-mini": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2,
		outputPrice: 10,
		description: "xAI Grok-2 Mini model via Poe",
	},
	"kimi-k1.5": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 14,
		outputPrice: 14,
		description: "Moonshot AI Kimi K1.5 model via Poe",
	},
	"glm-4-plus": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 10,
		outputPrice: 10,
		description: "Zhipu AI GLM-4 Plus model via Poe",
	},
} as const satisfies Record<string, ModelInfo>

// Default model info for custom bots
export const poeDefaultModelInfo: ModelInfo = {
	maxTokens: 4096,
	contextWindow: 128000,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
	description: "Custom Poe bot",
}
