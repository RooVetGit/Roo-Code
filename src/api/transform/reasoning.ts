import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import OpenAI from "openai"

import { ModelInfo, ProviderSettings } from "../../schemas"
import { shouldUseReasoningBudget, shouldUseReasoningEffort } from "../../shared/api"

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

export const getOpenRouterReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenRouterReasoningParams | undefined =>
	shouldUseReasoningBudget({ model, settings })
		? { max_tokens: params.reasoningBudget }
		: shouldUseReasoningEffort({ model, settings })
			? { effort: params.reasoningEffort }
			: undefined

export const getAnthropicReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): AnthropicReasoningParams | undefined =>
	shouldUseReasoningBudget({ model, settings })
		? { type: "enabled", budget_tokens: params.reasoningBudget! }
		: undefined

export const getOpenAiReasoning = ({
	model,
	params,
	settings,
}: GetModelResoningOptions): OpenAiReasoningParams | undefined =>
	shouldUseReasoningEffort({ model, settings }) ? { reasoning_effort: params.reasoningEffort } : undefined
