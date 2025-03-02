import { Anthropic } from "@anthropic-ai/sdk"
import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/index.mjs"

import { ApiConfiguration, ModelInfo, ApiHandlerOptions } from "../shared/api"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./providers/constants"
import { GlamaHandler } from "./providers/glama"
import { AnthropicHandler } from "./providers/anthropic"
import { AwsBedrockHandler } from "./providers/bedrock"
import { OpenRouterHandler } from "./providers/openrouter"
import { VertexHandler } from "./providers/vertex"
import { OpenAiHandler } from "./providers/openai"
import { OllamaHandler } from "./providers/ollama"
import { LmStudioHandler } from "./providers/lmstudio"
import { GeminiHandler, ApiKeyRotationCallback, RequestCountUpdateCallback } from "./providers/gemini"
import { OpenAiNativeHandler } from "./providers/openai-native"
import { DeepSeekHandler } from "./providers/deepseek"
import { MistralHandler } from "./providers/mistral"
import { VsCodeLmHandler } from "./providers/vscode-lm"
import { ApiStream } from "./transform/stream"
import { UnboundHandler } from "./providers/unbound"
import { RequestyHandler } from "./providers/requesty"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandler {
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream
	getModel(): { id: string; info: ModelInfo }
}

/**
 * Callbacks that can be passed to API handlers
 */
export interface ApiHandlerCallbacks {
	onGeminiApiKeyRotation?: ApiKeyRotationCallback
	onGeminiRequestCountUpdate?: RequestCountUpdateCallback
	geminiInitialRequestCount?: number
}

export function buildApiHandler(configuration: ApiConfiguration, callbacks?: ApiHandlerCallbacks): ApiHandler {
	const { apiProvider, ...handlerOptions } = configuration
	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler(handlerOptions)
		case "glama":
			return new GlamaHandler(handlerOptions)
		case "openrouter":
			return new OpenRouterHandler(handlerOptions)
		case "bedrock":
			return new AwsBedrockHandler(handlerOptions)
		case "vertex":
			return new VertexHandler(handlerOptions)
		case "openai":
			return new OpenAiHandler(handlerOptions)
		case "ollama":
			return new OllamaHandler(handlerOptions)
		case "lmstudio":
			return new LmStudioHandler(handlerOptions)
		case "gemini":
			return new GeminiHandler(handlerOptions, {
				onApiKeyRotation: callbacks?.onGeminiApiKeyRotation,
				onRequestCountUpdate: callbacks?.onGeminiRequestCountUpdate,
				initialRequestCount: callbacks?.geminiInitialRequestCount,
			})
		case "openai-native":
			return new OpenAiNativeHandler(handlerOptions)
		case "deepseek":
			return new DeepSeekHandler(handlerOptions)
		case "vscode-lm":
			return new VsCodeLmHandler(handlerOptions)
		case "mistral":
			return new MistralHandler(handlerOptions)
		case "unbound":
			return new UnboundHandler(handlerOptions)
		case "requesty":
			return new RequestyHandler(handlerOptions)
		default:
			return new AnthropicHandler(handlerOptions)
	}
}

export function getModelParams({
	options,
	model,
	defaultMaxTokens,
	defaultTemperature = 0,
}: {
	options: ApiHandlerOptions
	model: ModelInfo
	defaultMaxTokens?: number
	defaultTemperature?: number
}) {
	const {
		modelMaxTokens: customMaxTokens,
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
	} = options

	let maxTokens = model.maxTokens ?? defaultMaxTokens
	let thinking: BetaThinkingConfigParam | undefined = undefined
	let temperature = customTemperature ?? defaultTemperature

	if (model.thinking) {
		// Only honor `customMaxTokens` for thinking models.
		maxTokens = customMaxTokens ?? maxTokens

		// Clamp the thinking budget to be at most 80% of max tokens and at
		// least 1024 tokens.
		const maxBudgetTokens = Math.floor((maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS) * 0.8)
		const budgetTokens = Math.max(Math.min(customMaxThinkingTokens ?? maxBudgetTokens, maxBudgetTokens), 1024)
		thinking = { type: "enabled", budget_tokens: budgetTokens }

		// Anthropic "Thinking" models require a temperature of 1.0.
		temperature = 1.0
	}

	return { maxTokens, thinking, temperature }
}
