import { Anthropic } from "@anthropic-ai/sdk"
import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/index.mjs"

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
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[], cacheKey?: string): ApiStream

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


/**
 * Read an environment variable value, returning a default value if not set. If neither key nor default is set,
 * returns undefined
 * @param key The environment variable key
 * @param defaultValue The default value to return if the variable is not set
 * @returns The value of the environment variable or the default value
 */
export function getEnvVar(key: string | undefined, defaultValue?: string | undefined): string | undefined {
	if (key === undefined) {
		return defaultValue
	}
	return process.env[key as string] ?? defaultValue
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	switch (apiProvider) {
		case "anthropic":
			options.apiKey = getEnvVar(options.apiKeyEnvVar, options.apiKey)
			return new AnthropicHandler(options)
		case "glama":
			options.glamaApiKey = getEnvVar(options.glamaApiKeyEnvVar, options.glamaApiKey)
			return new GlamaHandler(options)
		case "openrouter":
			options.openRouterApiKey = getEnvVar(options.openRouterApiKeyEnvVar, options.openRouterApiKey)
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
			options.openAiApiKey = getEnvVar(options.openAiApiKeyEnvVar, options.openAiApiKey)
			return new OpenAiHandler(options)
		case "ollama":
			return new OllamaHandler(options)
		case "lmstudio":
			return new LmStudioHandler(options)
		case "gemini":
			options.geminiApiKey = getEnvVar(options.geminiApiKeyEnvVar, options.geminiApiKey)
			return new GeminiHandler(options)
		case "openai-native":
			options.openAiNativeApiKey = getEnvVar(
				options.openAiNativeApiKeyEnvVar,
				options.openAiNativeApiKey
			)
			return new OpenAiNativeHandler(options)
		case "deepseek":
			options.deepSeekApiKey = getEnvVar(options.deepSeekApiKeyEnvVar, options.deepSeekApiKey)
			return new DeepSeekHandler(options)
		case "vscode-lm":
			return new VsCodeLmHandler(options)
		case "mistral":
			options.mistralApiKey = getEnvVar(options.mistralApiKeyEnvVar, options.mistralApiKey)
			return new MistralHandler(options)
		case "unbound":
			options.unboundApiKey = getEnvVar(options.unboundApiKeyEnvVar, options.unboundApiKey)
			return new UnboundHandler(options)
		case "requesty":
			options.requestyApiKey = getEnvVar(options.requestyApiKeyEnvVar, options.requestyApiKey)
			return new RequestyHandler(options)
		case "human-relay":
			return new HumanRelayHandler()
		case "fake-ai":
			return new FakeAIHandler(options)
		case "xai":
			options.xaiApiKey = getEnvVar(options.xaiApiKeyEnvVar, options.xaiApiKey)
			return new XAIHandler(options)
		case "groq":
			options.groqApiKey = getEnvVar(options.groqApiKeyEnvVar, options.groqApiKey)
			return new GroqHandler(options)
		case "chutes":
			options.chutesApiKey = getEnvVar(options.chutesApiKeyEnvVar, options.chutesApiKey)
			return new ChutesHandler(options)
		case "litellm":
			options.litellmApiKey = getEnvVar(options.litellmApiKeyEnvVar, options.litellmApiKey)
			return new LiteLLMHandler(options)
		default:
			options.apiKey = getEnvVar(options.apiKeyEnvVar, options.apiKey)
			return new AnthropicHandler(options)
	}
}

export function getModelParams({
	options,
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
}) {
	const {
		modelMaxTokens: customMaxTokens,
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
		reasoningEffort: customReasoningEffort,
	} = options

	let maxTokens = model.maxTokens ?? defaultMaxTokens
	let thinking: BetaThinkingConfigParam | undefined = undefined
	let temperature = customTemperature ?? defaultTemperature
	const reasoningEffort = customReasoningEffort ?? defaultReasoningEffort

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

	return { maxTokens, thinking, temperature, reasoningEffort }
}
