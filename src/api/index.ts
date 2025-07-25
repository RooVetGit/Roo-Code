import { Anthropic } from "@anthropic-ai/sdk"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"

import {
	GlamaHandler,
	AnthropicHandler,
	AwsBedrockHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OllamaHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	HumanRelayHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	HuggingFaceHandler,
	ChutesHandler,
	LiteLLMHandler,
	ClaudeCodeHandler,
} from "./providers"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	mode?: string
	taskId: string
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

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
			if (options.anthropicApiKeyUseEnvVar) {
				options.apiKey = getEnvVar("ANTHROPIC_API_KEY", options.apiKey)
			}
			return new AnthropicHandler(options)
		case "claude-code":
			return new ClaudeCodeHandler(options)
		case "glama":
			if (options.glamaApiKeyUseEnvVar) {
				options.glamaApiKey = getEnvVar("GLAMA_API_KEY", options.glamaApiKey)
			}
			return new GlamaHandler(options)
		case "openrouter":
			if (options.openRouterApiKeyUseEnvVar) {
				options.openRouterApiKey = getEnvVar("OPEN_ROUTER_API_KEY", options.openRouterApiKey)
			}
			return new OpenRouterHandler(options)
		case "bedrock":
			return new AwsBedrockHandler(options)
		case "vertex":
			return options.apiModelId?.startsWith("claude")
				? new AnthropicVertexHandler(options)
				: new VertexHandler(options)
		case "openai":
			if (options.openAiApiKeyUseEnvVar) {
				options.openAiApiKey = getEnvVar("OPEN_AI_API_KEY", options.openAiApiKey)
			}
			return new OpenAiHandler(options)
		case "ollama":
			return new OllamaHandler(options)
		case "lmstudio":
			return new LmStudioHandler(options)
		case "gemini":
			if (options.geminiApiKeyUseEnvVar) {
				options.geminiApiKey = getEnvVar("GEMINI_API_KEY", options.geminiApiKey)
			}
			return new GeminiHandler(options)
		case "openai-native":
			if (options.openAiNativeApiKeyUseEnvVar) {
				options.openAiNativeApiKey = getEnvVar("OPEN_AI_NATIVE_API_KEY", options.openAiNativeApiKey)
			}
			return new OpenAiNativeHandler(options)
		case "deepseek":
			if (options.deepSeekApiKeyUseEnvVar) {
				options.deepSeekApiKey = getEnvVar("DEEP_SEEK_API_KEY", options.deepSeekApiKey)
			}
			return new DeepSeekHandler(options)
		case "moonshot":
			return new MoonshotHandler(options)
		case "vscode-lm":
			return new VsCodeLmHandler(options)
		case "mistral":
			if (options.mistralApiKeyUseEnvVar) {
				options.mistralApiKey = getEnvVar("MISTRAL_API_KEY", options.mistralApiKey)
			}
			return new MistralHandler(options)
		case "unbound":
			if (options.unboundApiKeyUseEnvVar) {
				options.unboundApiKey = getEnvVar("UNBOUND_API_KEY", options.unboundApiKey)
			}
			return new UnboundHandler(options)
		case "requesty":
			if (options.requestyApiKeyUseEnvVar) {
				options.requestyApiKey = getEnvVar("REQUESTY_API_KEY", options.requestyApiKey)
			}
			return new RequestyHandler(options)
		case "human-relay":
			return new HumanRelayHandler()
		case "fake-ai":
			return new FakeAIHandler(options)
		case "xai":
			if (options.xaiApiKeyUseEnvVar) {
				options.xaiApiKey = getEnvVar("XAI_API_KEY", options.xaiApiKey)
			}
			return new XAIHandler(options)
		case "groq":
			if (options.groqApiKeyUseEnvVar) {
				options.groqApiKey = getEnvVar("GROQ_API_KEY", options.groqApiKey)
			}
			return new GroqHandler(options)
		case "huggingface":
			return new HuggingFaceHandler(options)
		case "chutes":
			if (options.chutesApiKeyUseEnvVar) {
				options.chutesApiKey = getEnvVar("CHUTES_API_KEY", options.chutesApiKey)
			}
			return new ChutesHandler(options)
		case "litellm":
			if (options.litellmApiKeyUseEnvVar) {
				options.litellmApiKey = getEnvVar("LITELLM_API_KEY", options.litellmApiKey)
			}
			return new LiteLLMHandler(options)
		default:
			apiProvider satisfies "gemini-cli" | undefined
			return new AnthropicHandler(options)
	}
}
