import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import OpenAI from "openai"

import { ModelInfo, ProviderSettings } from "../../schemas"

import type { ModelParams } from "./model-params"

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

const shouldUseReasoningBudget = (model: ModelInfo, settings: ProviderSettings, params: ModelParams) =>
	(model.requiredReasoningBudget || (model.supportsReasoningBudget && settings.enableReasoningEffort)) &&
	params.reasoningBudget

const shouldUseReasoningEffort = (model: ModelInfo, params: ModelParams) =>
	model.supportsReasoningEffort && params.reasoningEffort

export const getOpenRouterReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenRouterReasoningParams | undefined =>
	shouldUseReasoningBudget(model, settings, params)
		? { max_tokens: params.reasoningBudget }
		: shouldUseReasoningEffort(model, params)
			? { effort: params.reasoningEffort }
			: undefined

export const getAnthropicReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): AnthropicReasoningParams | undefined =>
	shouldUseReasoningBudget(model, settings, params)
		? { type: "enabled", budget_tokens: params.reasoningBudget! }
		: undefined

export const getOpenAiReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenAiReasoningParams | undefined =>
	shouldUseReasoningEffort(model, params) ? { reasoning_effort: params.reasoningEffort } : undefined
