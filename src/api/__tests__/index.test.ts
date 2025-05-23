// npx jest src/api/__tests__/index.test.ts

import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/index.mjs"

import { ModelInfo } from "../../schemas"
import { getModelParams } from "../index"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "../providers/constants"

describe("getModelParams", () => {
	it("should return default values when no custom values are provided", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		const result = getModelParams({
			options: {},
			model,
			defaultMaxTokens: 1000,
			defaultTemperature: 0.5,
		})

		expect(result).toEqual({
			maxTokens: 1000,
			thinking: undefined,
			temperature: 0.5,
		})
	})

	it("should use custom temperature from options when provided", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		const result = getModelParams({
			options: { modelTemperature: 0.7 },
			model,
			defaultMaxTokens: 1000,
			defaultTemperature: 0.5,
		})

		expect(result).toEqual({
			maxTokens: 1000,
			thinking: undefined,
			temperature: 0.7,
		})
	})

	it("should use model maxTokens when available", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		expect(getModelParams({ options: {}, model, defaultMaxTokens: 1000 })).toEqual({
			maxTokens: 2000,
			thinking: undefined,
			temperature: 0,
		})
	})

	it("should handle thinking models correctly", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: {}, model })).toEqual({
			maxTokens: 2000,
			reasoningBudget: 1600, // 80% of 2000,
			temperature: 1.0, // Thinking models require temperature 1.0.
		})
	})

	it("should honor customMaxTokens for thinking models", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: { modelMaxTokens: 3000 }, model, defaultMaxTokens: 2000 })).toEqual({
			maxTokens: 3000,
			reasoningBudget: 2400, // 80% of 3000,
			temperature: 1.0,
		})
	})

	it("should honor customMaxThinkingTokens for thinking models", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: { modelMaxThinkingTokens: 1500 }, model })).toEqual({
			maxTokens: 4000,
			reasoningBudget: 1500, // Using the custom value.
			temperature: 1.0,
		})
	})

	it("should not honor customMaxThinkingTokens for non-thinking models", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		expect(getModelParams({ options: { modelMaxThinkingTokens: 1500 }, model })).toEqual({
			maxTokens: 4000,
			reasoningBudget: undefined, // Should remain undefined despite customMaxThinkingTokens being set.
			reasoningEffort: undefined,
			temperature: 0, // Using default temperature.
		})
	})

	it("should clamp thinking budget to at least 1024 tokens", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: { modelMaxThinkingTokens: 500 }, model })).toEqual({
			maxTokens: 2000,
			reasoningBudget: 1024, // Minimum is 1024
			temperature: 1.0,
		})
	})

	it("should clamp thinking budget to at most 80% of max tokens", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: { modelMaxThinkingTokens: 5000 }, model })).toEqual({
			maxTokens: 4000,
			reasoningBudget: 3200, // 80% of 4000
			temperature: 1.0,
		})
	})

	it("should use ANTHROPIC_DEFAULT_MAX_TOKENS when no maxTokens is provided for thinking models", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ options: {}, model })).toEqual({
			maxTokens: undefined,
			temperature: 1.0,
			reasoningBudget: Math.floor(ANTHROPIC_DEFAULT_MAX_TOKENS * 0.8),
		})
	})
})
