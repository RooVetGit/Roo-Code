// npx jest src/api/__tests__/index.test.ts

import { ModelInfo } from "../../schemas"
import { getModelParams } from "../transform/model-params"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "../providers/constants"

describe("getModelParams", () => {
	it("should return default values when no custom values are provided", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		const result = getModelParams({
			format: "openai",
			settings: {},
			model,
			defaultMaxTokens: 1000,
			defaultTemperature: 0.5,
		})

		expect(result).toEqual({
			format: "openai",
			maxTokens: 1000,
			temperature: 0.5,
			reasoningEffort: undefined,
			reasoningBudget: undefined,
			reasoning: undefined,
		})
	})

	it("should use custom temperature from options when provided", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		const result = getModelParams({
			format: "openai",
			settings: { modelTemperature: 0.7 },
			model,
			defaultMaxTokens: 1000,
			defaultTemperature: 0.5,
		})

		expect(result).toEqual({
			format: "openai",
			maxTokens: 1000,
			temperature: 0.7,
			reasoningEffort: undefined,
			reasoningBudget: undefined,
			reasoning: undefined,
		})
	})

	it("should use model maxTokens when available", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		expect(getModelParams({ format: "openai", settings: {}, model, defaultMaxTokens: 1000 })).toEqual({
			format: "openai",
			maxTokens: 2000,
			temperature: 0,
			reasoningEffort: undefined,
			reasoningBudget: undefined,
			reasoning: undefined,
		})
	})

	it("should handle thinking models correctly", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ format: "openai", settings: {}, model })).toEqual({
			format: "openai",
			maxTokens: 2000,
			temperature: 1.0, // Thinking models require temperature 1.0.
			reasoningEffort: undefined,
			reasoningBudget: 1600, // 80% of 2000,
			reasoning: undefined,
		})
	})

	it("should honor customMaxTokens for thinking models", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(
			getModelParams({ format: "openai", settings: { modelMaxTokens: 3000 }, model, defaultMaxTokens: 2000 }),
		).toEqual({
			format: "openai",
			maxTokens: 3000,
			temperature: 1.0,
			reasoningEffort: undefined,
			reasoningBudget: 2400, // 80% of 3000,
			reasoning: undefined,
		})
	})

	it("should honor customMaxThinkingTokens for thinking models", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ format: "openai", settings: { modelMaxThinkingTokens: 1500 }, model })).toEqual({
			format: "openai",
			maxTokens: 4000,
			temperature: 1.0,
			reasoningEffort: undefined,
			reasoningBudget: 1500, // Using the custom value.
			reasoning: undefined,
		})
	})

	it("should not honor customMaxThinkingTokens for non-thinking models", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
		}

		expect(getModelParams({ format: "openai", settings: { modelMaxThinkingTokens: 1500 }, model })).toEqual({
			format: "openai",
			maxTokens: 4000,
			temperature: 0, // Using default temperature.
			reasoningEffort: undefined,
			reasoningBudget: undefined, // Should remain undefined despite customMaxThinkingTokens being set.
			reasoning: undefined,
		})
	})

	it("should clamp thinking budget to at least 1024 tokens", () => {
		const model: ModelInfo = {
			maxTokens: 2000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ format: "openai", settings: { modelMaxThinkingTokens: 500 }, model })).toEqual({
			format: "openai",
			maxTokens: 2000,
			temperature: 1.0,
			reasoningEffort: undefined,
			reasoningBudget: 1024, // Minimum is 1024
			reasoning: undefined,
		})
	})

	it("should clamp thinking budget to at most 80% of max tokens", () => {
		const model: ModelInfo = {
			maxTokens: 4000,
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ format: "openai", settings: { modelMaxThinkingTokens: 5000 }, model })).toEqual({
			format: "openai",
			maxTokens: 4000,
			temperature: 1.0,
			reasoningEffort: undefined,
			reasoningBudget: 3200, // 80% of 4000
			reasoning: undefined,
		})
	})

	it("should use ANTHROPIC_DEFAULT_MAX_TOKENS when no maxTokens is provided for thinking models", () => {
		const model: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		}

		expect(getModelParams({ format: "openai", settings: {}, model })).toEqual({
			format: "openai",
			maxTokens: undefined,
			temperature: 1.0,
			reasoningEffort: undefined,
			reasoningBudget: Math.floor(ANTHROPIC_DEFAULT_MAX_TOKENS * 0.8),
			reasoning: undefined,
		})
	})
})
