import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import OpenAI from "openai"

import { ModelInfo, ProviderSettings } from "../../schemas"
import { ModelParams } from "../index"

export type OpenRouterReasoningParams = {
	effort?: "high" | "medium" | "low"
	max_tokens?: number
	exclude?: boolean
}

export type AnthropicReasoningParams = BetaThinkingConfigParam

export type OpenAiReasoningParams = { reasoning_effort: OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"] }

export type GetModelResoningOptions = {
	model: ModelInfo
	params: ModelParams
	settings: ProviderSettings
}

export function getOpenRouterReasoning({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenRouterReasoningParams | undefined {
	if (model.requiredReasoningBudget || (model.supportsReasoningBudget && settings.enableReasoningEffort)) {
		return { max_tokens: params.reasoningBudget }
	} else if (model.supportsReasoningEffort && settings.reasoningEffort) {
		return { effort: params.reasoningEffort }
	} else {
		return undefined
	}
}

export function getAnthropicReasoning({
	model,
	params,
	settings,
}: GetModelResoningOptions): AnthropicReasoningParams | undefined {
	return (model.requiredReasoningBudget || (model.supportsReasoningBudget && settings.enableReasoningEffort)) &&
		params.reasoningBudget
		? { type: "enabled", budget_tokens: params.reasoningBudget }
		: undefined
}

export function getOpenAiReasoning({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenAiReasoningParams | undefined {
	if (model.supportsReasoningEffort && settings.reasoningEffort && params.reasoningEffort) {
		return { reasoning_effort: params.reasoningEffort }
	} else {
		return undefined
	}
}
