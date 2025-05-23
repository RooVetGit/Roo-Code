import { Anthropic } from "@anthropic-ai/sdk"

import { ProviderSettings, ModelInfo, ApiHandlerOptions } from "../shared/api"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./providers/constants"
import { GlamaHandler } from "./providers/glama"
import { AnthropicHandler } from "./providers/anthropic"
import { AwsBedrockHandler } from "./providers/bedrock"
import { OpenRouterHandler } from "./providers/openrouter"
import { VertexHandler } from "./providers/vertex"
import { AnthropicVertexHandler } from "./providers/anthropic-vertex"
import { OpenAiHandler } from "./providers/openai"
import { OllamaHandler } from "./providers/ollama"
import { LmStudioHandler } from "./providers/lmstudio"
import { GeminiHandler } from "./providers/gemini"
import { OpenAiNativeHandler } from "./providers/openai-native"
import { DeepSeekHandler } from "./providers/deepseek"
import { MistralHandler } from "./providers/mistral"
import { VsCodeLmHandler } from "./providers/vscode-lm"
import { ApiStream } from "./transform/stream"
import { UnboundHandler } from "./providers/unbound"
import { RequestyHandler } from "./providers/requesty"
import { HumanRelayHandler } from "./providers/human-relay"
import { FakeAIHandler } from "./providers/fake-ai"
import { XAIHandler } from "./providers/xai"
import { GroqHandler } from "./providers/groq"
import { ChutesHandler } from "./providers/chutes"
import { LiteLLMHandler } from "./providers/litellm"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandler {
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler(options)
		case "glama":
			return new GlamaHandler(options)
		case "openrouter":
			return new OpenRouterHandler(options)
		case "bedrock":
			return new AwsBedrockHandler(options)
		case "vertex":
			if (options.apiModelId?.startsWith("claude")) {
				return new AnthropicVertexHandler(options)
			} else {
				return new VertexHandler(options)
			}
		case "openai":
			return new OpenAiHandler(options)
		case "ollama":
			return new OllamaHandler(options)
		case "lmstudio":
			return new LmStudioHandler(options)
		case "gemini":
			return new GeminiHandler(options)
		case "openai-native":
			return new OpenAiNativeHandler(options)
		case "deepseek":
			return new DeepSeekHandler(options)
		case "vscode-lm":
			return new VsCodeLmHandler(options)
		case "mistral":
			return new MistralHandler(options)
		case "unbound":
			return new UnboundHandler(options)
		case "requesty":
			return new RequestyHandler(options)
		case "human-relay":
			return new HumanRelayHandler()
		case "fake-ai":
			return new FakeAIHandler(options)
		case "xai":
			return new XAIHandler(options)
		case "groq":
			return new GroqHandler(options)
		case "chutes":
			return new ChutesHandler(options)
		case "litellm":
			return new LiteLLMHandler(options)
		default:
			return new AnthropicHandler(options)
	}
}

type ModelParams = {
	maxTokens: number | undefined
	temperature: number
	reasoningEffort: "low" | "medium" | "high" | undefined
	reasoningBudget: number | undefined
}

export function getModelParams({
	options: {
		modelMaxTokens: customMaxTokens,
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
		reasoningEffort: customReasoningEffort,
	},
	model,
	defaultMaxTokens,
	defaultTemperature = 0,
	defaultReasoningEffort,
}: {
	options: ApiHandlerOptions
	model: ModelInfo
	defaultMaxTokens?: number
	defaultTemperature?: number
	defaultReasoningEffort?: "low" | "medium" | "high"
}): ModelParams {
	let maxTokens = model.maxTokens ?? defaultMaxTokens
	let temperature = customTemperature ?? defaultTemperature
	let reasoningEffort: ModelParams["reasoningEffort"] = undefined
	let reasoningBudget: ModelParams["reasoningBudget"] = undefined

	if (model.supportsReasoningBudget) {
		// "Hybrid" reasoning models use the `reasoningBudget` parameter.
		maxTokens = customMaxTokens ?? maxTokens

		// Clamp the thinking budget to be at most 80% of max tokens and at
		// least 1024 tokens.
		const maxBudgetTokens = Math.floor((maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS) * 0.8)
		reasoningBudget = Math.max(Math.min(customMaxThinkingTokens ?? maxBudgetTokens, maxBudgetTokens), 1024)

		// Let's assume that "Hybrid" reasoning models require a temperature of
		// 1.0 since Anthropic does.
		temperature = 1.0
	} else if (model.supportsReasoningEffort) {
		// "Traditional" reasoning models use the `reasoningEffort` parameter.
		reasoningEffort = customReasoningEffort ?? defaultReasoningEffort
	}

	return { maxTokens, temperature, reasoningEffort, reasoningBudget }
}
