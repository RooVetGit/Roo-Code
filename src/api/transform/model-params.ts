import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "../providers/constants"
import type { ModelInfo, ProviderSettings } from "../../shared/api"

import {
	type AnthropicReasoningParams,
	type OpenAiReasoningParams,
	type OpenRouterReasoningParams,
	getAnthropicReasoning,
	getOpenAiReasoning,
	getOpenRouterReasoning,
} from "./reasoning"

type GetModelParamsOptions<T extends "openai" | "anthropic" | "openrouter"> = {
	format: T
	settings: ProviderSettings
	model: ModelInfo
	defaultMaxTokens?: number
	defaultTemperature?: number
}

type BaseModelParams = {
	maxTokens: number | undefined
	temperature: number
	reasoningEffort: "low" | "medium" | "high" | undefined
	reasoningBudget: number | undefined
}

type OpenAiModelParams = {
	format: "openai"
	reasoning: OpenAiReasoningParams | undefined
} & BaseModelParams

type AnthropicModelParams = {
	format: "anthropic"
	reasoning: AnthropicReasoningParams | undefined
} & BaseModelParams

type OpenRouterModelParams = {
	format: "openrouter"
	reasoning: OpenRouterReasoningParams | undefined
} & BaseModelParams

export type ModelParams = OpenAiModelParams | AnthropicModelParams | OpenRouterModelParams

// Function overloads for specific return types
export function getModelParams(options: GetModelParamsOptions<"openai">): OpenAiModelParams
export function getModelParams(options: GetModelParamsOptions<"anthropic">): AnthropicModelParams
export function getModelParams(options: GetModelParamsOptions<"openrouter">): OpenRouterModelParams
export function getModelParams({
	format,
	settings,
	model,
	defaultMaxTokens,
	defaultTemperature = 0,
}: GetModelParamsOptions<"openai" | "anthropic" | "openrouter">): ModelParams {
	const {
		modelMaxTokens: customMaxTokens,
		modelMaxThinkingTokens: customMaxThinkingTokens,
		modelTemperature: customTemperature,
		reasoningEffort: customReasoningEffort,
	} = settings

	let maxTokens = model.maxTokens ?? defaultMaxTokens
	let temperature = customTemperature ?? defaultTemperature
	let reasoningBudget: ModelParams["reasoningBudget"] = undefined
	let reasoningEffort: ModelParams["reasoningEffort"] = undefined

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
		reasoningEffort = customReasoningEffort ?? model.reasoningEffort
	}

	const params: BaseModelParams = { maxTokens, temperature, reasoningEffort, reasoningBudget }

	if (format === "anthropic") {
		return {
			format,
			...params,
			reasoning: getAnthropicReasoning({ model, reasoningBudget, reasoningEffort, settings }),
		}
	} else if (format === "openai") {
		return {
			format,
			...params,
			reasoning: getOpenAiReasoning({ model, reasoningBudget, reasoningEffort, settings }),
		}
	} else {
		return {
			format,
			...params,
			reasoning: getOpenRouterReasoning({ model, reasoningBudget, reasoningEffort, settings }),
		}
	}
}
