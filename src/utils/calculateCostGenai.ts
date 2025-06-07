import type { ModelInfo } from "@roo-code/types"

/**
 * Calculate the cost for GenAI models (Gemini and Vertex AI) based on token usage
 * @param options - Token usage and model information
 * @returns Total cost in USD or undefined if pricing info is missing
 */
export function calculateCostGenai({
	info,
	inputTokens,
	outputTokens,
	cacheReadTokens = 0,
}: {
	info: ModelInfo
	inputTokens: number
	outputTokens: number
	cacheReadTokens?: number
}): number | undefined {
	if (!info.inputPrice || !info.outputPrice || !info.cacheReadsPrice) {
		return undefined
	}

	let inputPrice = info.inputPrice
	let outputPrice = info.outputPrice
	let cacheReadsPrice = info.cacheReadsPrice

	// If there's tiered pricing then adjust the input and output token prices
	// based on the input tokens used.
	if (info.tiers) {
		const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

		if (tier) {
			inputPrice = tier.inputPrice ?? inputPrice
			outputPrice = tier.outputPrice ?? outputPrice
			cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
		}
	}

	// Subtract the cached input tokens from the total input tokens.
	const uncachedInputTokens = inputTokens - cacheReadTokens

	let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

	const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
	const outputTokensCost = outputPrice * (outputTokens / 1_000_000)
	const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

	const trace: Record<string, { price: number; tokens: number; cost: number }> = {
		input: { price: inputPrice, tokens: uncachedInputTokens, cost: inputTokensCost },
		output: { price: outputPrice, tokens: outputTokens, cost: outputTokensCost },
	}

	if (cacheReadTokens > 0) {
		trace.cacheRead = { price: cacheReadsPrice, tokens: cacheReadTokens, cost: cacheReadCost }
	}

	return totalCost
}
