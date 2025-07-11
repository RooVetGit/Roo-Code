import { describe, test, expect } from "vitest"
import { getModelMaxOutputTokens } from "../api"
import type { ModelInfo, ProviderSettings } from "@roo-code/types"

describe("getModelMaxOutputTokens", () => {
	const mockModel: ModelInfo = {
		maxTokens: 8192,
		contextWindow: 200000,
		supportsPromptCache: true,
	}

	test("should return claudeCodeMaxOutputTokens when using claude-code provider", () => {
		const settings: ProviderSettings = {
			apiProvider: "claude-code",
			claudeCodeMaxOutputTokens: 16384,
		}

		const result = getModelMaxOutputTokens({
			modelId: "claude-3-5-sonnet-20241022",
			model: mockModel,
			settings,
		})

		expect(result).toBe(16384)
	})

	test("should return model maxTokens when not using claude-code provider", () => {
		const settings: ProviderSettings = {
			apiProvider: "anthropic",
		}

		const result = getModelMaxOutputTokens({
			modelId: "claude-3-5-sonnet-20241022",
			model: mockModel,
			settings,
		})

		expect(result).toBe(8192)
	})

	test("should return default 8000 when claude-code provider has no custom max tokens", () => {
		const settings: ProviderSettings = {
			apiProvider: "claude-code",
			// No claudeCodeMaxOutputTokens set
		}

		const result = getModelMaxOutputTokens({
			modelId: "claude-3-5-sonnet-20241022",
			model: mockModel,
			settings,
		})

		expect(result).toBe(8000)
	})

	test("should handle reasoning budget models correctly", () => {
		const reasoningModel: ModelInfo = {
			...mockModel,
			supportsReasoningBudget: true,
			requiredReasoningBudget: true,
		}

		const settings: ProviderSettings = {
			apiProvider: "anthropic",
			enableReasoningEffort: true,
			modelMaxTokens: 32000,
		}

		const result = getModelMaxOutputTokens({
			modelId: "claude-3-7-sonnet-20250219",
			model: reasoningModel,
			settings,
		})

		expect(result).toBe(32000)
	})

	test("should return 20% of context window when maxTokens is undefined", () => {
		const modelWithoutMaxTokens: ModelInfo = {
			contextWindow: 100000,
			supportsPromptCache: true,
		}

		const result = getModelMaxOutputTokens({
			modelId: "some-model",
			model: modelWithoutMaxTokens,
			settings: {},
		})

		expect(result).toBe(20000) // 20% of 100000
	})
})
