// npx jest src/shared/__tests__/api.test.ts

import { type ModelInfo, ProviderSettings, getModelMaxOutputTokens } from "../api"

describe("getMaxTokensForModel", () => {
	/**
	 * Testing the specific fix in commit cc79178f:
	 * For thinking models, use apiConfig.modelMaxTokens if available,
	 * otherwise fall back to 8192 (not modelInfo.maxTokens)
	 */

	it("should return apiConfig.modelMaxTokens for thinking models when provided", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			requiredReasoningBudget: true,
			maxTokens: 8000,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4000,
		}

		expect(getModelMaxOutputTokens({ model, settings })).toBe(4000)
	})

	it("should return 16_384 for thinking models when modelMaxTokens not provided", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			requiredReasoningBudget: true,
			maxTokens: 8000,
		}

		const settings = {}

		expect(getModelMaxOutputTokens({ model, settings })).toBe(16_384)
	})

	it("should return 16_384 for thinking models when apiConfig is undefined", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			requiredReasoningBudget: true,
			maxTokens: 8000,
		}

		expect(getModelMaxOutputTokens({ model, settings: undefined })).toBe(16_384)
	})

	it("should return modelInfo.maxTokens for non-thinking models", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 8000,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4000,
		}

		expect(getModelMaxOutputTokens({ model, settings })).toBe(8000)
	})

	it("should return undefined for non-thinking models with undefined maxTokens", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4000,
		}

		expect(getModelMaxOutputTokens({ model, settings })).toBeUndefined()
	})

	test("should return maxTokens from modelInfo when thinking is false", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 2048,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4096,
		}

		const result = getModelMaxOutputTokens({ model, settings })
		expect(result).toBe(2048)
	})

	test("should return modelMaxTokens from apiConfig when thinking is true", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 2048,
			requiredReasoningBudget: true,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4096,
		}

		const result = getModelMaxOutputTokens({ model, settings })
		expect(result).toBe(4096)
	})

	test("should fallback to DEFAULT_THINKING_MODEL_MAX_TOKENS when thinking is true but apiConfig.modelMaxTokens is not defined", () => {
		const model: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 2048,
			requiredReasoningBudget: true,
		}

		const settings: ProviderSettings = {}

		const result = getModelMaxOutputTokens({ model, settings: undefined })
		expect(result).toBe(16_384)
	})

	test("should handle undefined inputs gracefully", () => {
		const modelInfoOnly: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 2048,
		}

		expect(getModelMaxOutputTokens({ model: modelInfoOnly, settings: undefined })).toBe(2048)
	})

	test("should handle missing properties gracefully", () => {
		const modelInfoWithoutMaxTokens: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			requiredReasoningBudget: true,
		}

		const settings: ProviderSettings = {
			modelMaxTokens: 4096,
		}

		expect(getModelMaxOutputTokens({ model: modelInfoWithoutMaxTokens, settings })).toBe(4096)

		const modelInfoWithoutThinking: ModelInfo = {
			contextWindow: 200_000,
			supportsPromptCache: true,
			maxTokens: 2048,
		}

		expect(getModelMaxOutputTokens({ model: modelInfoWithoutThinking, settings: undefined })).toBe(2048)
	})
})
