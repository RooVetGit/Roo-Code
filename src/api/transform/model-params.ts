import type { ModelInfo, ProviderSettings } from "../../shared/api"

import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "../providers/constants"

export type ModelParams = {
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
}: {
	options: ProviderSettings
	model: ModelInfo
	defaultMaxTokens?: number
	defaultTemperature?: number
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
		reasoningEffort = customReasoningEffort ?? model.reasoningEffort
	}

	return { maxTokens, temperature, reasoningEffort, reasoningBudget }
}
