// npx jest src/utils/__tests__/calculateCostGenai.test.ts

import type { ModelInfo } from "@roo-code/types"

import { calculateCostGenai } from "../calculateCostGenai"

describe("calculateCostGenai", () => {
	// Mock ModelInfo based on gemini-1.5-flash-latest pricing (per 1M tokens)
	const mockInfo: ModelInfo = {
		inputPrice: 0.125, // $/1M tokens
		outputPrice: 0.375, // $/1M tokens
		cacheWritesPrice: 0.125, // Assume same as input for test
		cacheReadsPrice: 0.125 * 0.25, // Assume 0.25x input for test
		contextWindow: 1_000_000,
		maxTokens: 8192,
		supportsPromptCache: true, // Enable cache calculations for tests
	}

	it("should calculate cost correctly based on input and output tokens", () => {
		const inputTokens = 10000 // Use larger numbers for per-million pricing
		const outputTokens = 20000
		// Added non-null assertions (!) as mockInfo guarantees these values
		const expectedCost =
			(inputTokens / 1_000_000) * mockInfo.inputPrice! + (outputTokens / 1_000_000) * mockInfo.outputPrice!

		const cost = calculateCostGenai({ info: mockInfo, inputTokens, outputTokens })
		expect(cost).toBeCloseTo(expectedCost)
	})

	it("should return 0 if token counts are zero", () => {
		// Note: The method expects numbers, not undefined. Passing undefined would be a type error.
		// The calculateCost method itself returns undefined if prices are missing, but 0 if tokens are 0 and prices exist.
		expect(calculateCostGenai({ info: mockInfo, inputTokens: 0, outputTokens: 0 })).toBe(0)
	})

	it("should handle only input tokens", () => {
		const inputTokens = 5000
		// Added non-null assertion (!)
		const expectedCost = (inputTokens / 1_000_000) * mockInfo.inputPrice!
		expect(calculateCostGenai({ info: mockInfo, inputTokens, outputTokens: 0 })).toBeCloseTo(expectedCost)
	})

	it("should handle only output tokens", () => {
		const outputTokens = 15000
		// Added non-null assertion (!)
		const expectedCost = (outputTokens / 1_000_000) * mockInfo.outputPrice!
		expect(calculateCostGenai({ info: mockInfo, inputTokens: 0, outputTokens })).toBeCloseTo(expectedCost)
	})

	it("should calculate cost with cache read tokens", () => {
		const inputTokens = 10000 // Total logical input
		const outputTokens = 20000
		const cacheReadTokens = 8000 // Part of inputTokens read from cache

		const uncachedReadTokens = inputTokens - cacheReadTokens
		// Added non-null assertions (!)
		const expectedInputCost = (uncachedReadTokens / 1_000_000) * mockInfo.inputPrice!
		const expectedOutputCost = (outputTokens / 1_000_000) * mockInfo.outputPrice!
		const expectedCacheReadCost = mockInfo.cacheReadsPrice! * (cacheReadTokens / 1_000_000)
		const expectedCost = expectedInputCost + expectedOutputCost + expectedCacheReadCost

		const cost = calculateCostGenai({ info: mockInfo, inputTokens, outputTokens, cacheReadTokens })
		expect(cost).toBeCloseTo(expectedCost)
	})

	it("should return undefined if pricing info is missing", () => {
		// Create a copy and explicitly set a price to undefined
		const incompleteInfo: ModelInfo = { ...mockInfo, outputPrice: undefined }
		const cost = calculateCostGenai({ info: incompleteInfo, inputTokens: 1000, outputTokens: 1000 })
		expect(cost).toBeUndefined()
	})

	it("should handle tiered pricing", () => {
		const tieredInfo: ModelInfo = {
			...mockInfo,
			tiers: [
				{
					contextWindow: 50000,
					inputPrice: 0.2,
					outputPrice: 0.6,
					cacheReadsPrice: 0.05,
				},
				{
					contextWindow: 1000000,
					inputPrice: 0.125,
					outputPrice: 0.375,
					cacheReadsPrice: 0.03125,
				},
			],
		}

		// Should use first tier pricing for small input
		const inputTokens = 30000
		const outputTokens = 20000
		const expectedCost = (inputTokens / 1_000_000) * 0.2 + (outputTokens / 1_000_000) * 0.6

		const cost = calculateCostGenai({ info: tieredInfo, inputTokens, outputTokens })
		expect(cost).toBeCloseTo(expectedCost)
	})

	it("should handle tiered pricing with cache reads", () => {
		const tieredInfo: ModelInfo = {
			...mockInfo,
			tiers: [
				{
					contextWindow: 50000,
					inputPrice: 0.2,
					outputPrice: 0.6,
					cacheReadsPrice: 0.05,
				},
			],
		}

		const inputTokens = 30000
		const outputTokens = 20000
		const cacheReadTokens = 10000
		const uncachedInputTokens = inputTokens - cacheReadTokens

		const expectedInputCost = (uncachedInputTokens / 1_000_000) * 0.2
		const expectedOutputCost = (outputTokens / 1_000_000) * 0.6
		const expectedCacheReadCost = (cacheReadTokens / 1_000_000) * 0.05
		const expectedCost = expectedInputCost + expectedOutputCost + expectedCacheReadCost

		const cost = calculateCostGenai({ info: tieredInfo, inputTokens, outputTokens, cacheReadTokens })
		expect(cost).toBeCloseTo(expectedCost)
	})
})
