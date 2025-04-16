import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./providers/constants"
import { GlamaHandler } from "./providers/glama"
import { AnthropicHandler } from "./providers/anthropic"
import { AwsBedrockHandler } from "./providers/bedrock"
import { OpenRouterHandler } from "./providers/openrouter"
import { VertexHandler } from "./providers/vertex"
import { OpenAiHandler } from "./providers/openai"
import { OllamaHandler } from "./providers/ollama"
import { LmStudioHandler } from "./providers/lmstudio"
import { GeminiHandler } from "./providers/gemini"
import { OpenAiNativeHandler } from "./providers/openai-native"
import { DeepSeekHandler } from "./providers/deepseek"
import { MistralHandler } from "./providers/mistral"
import { VsCodeLmHandler } from "./providers/vscode-lm"
import { UnboundHandler } from "./providers/unbound"
import { RequestyHandler } from "./providers/requesty"
import { FakeAIHandler } from "./providers/fake-ai"
export function buildApiHandler(configuration) {
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
			return new VertexHandler(options)
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
		case "fake-ai":
			return new FakeAIHandler(options)
		default:
			return new AnthropicHandler(options)
	}
}
export function getModelParams({ options, model, defaultMaxTokens, defaultTemperature = 0, defaultReasoningEffort }) {
	const {
		modelMaxTokens: customMaxTokens,
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
		reasoningEffort: customReasoningEffort,
	} = options
	let maxTokens = model.maxTokens ?? defaultMaxTokens
	let thinking = undefined
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
//# sourceMappingURL=index.js.map
