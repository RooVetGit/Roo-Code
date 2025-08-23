import type { ModelInfo } from "@roo-code/types"

function calculateApiCostInternal(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens: number,
	cacheReadInputTokens: number,
): number {
	const cacheWritesCost = ((modelInfo.cacheWritesPrice || 0) / 1_000_000) * cacheCreationInputTokens
	const cacheReadsCost = ((modelInfo.cacheReadsPrice || 0) / 1_000_000) * cacheReadInputTokens
	const baseInputCost = ((modelInfo.inputPrice || 0) / 1_000_000) * inputTokens
	const outputCost = ((modelInfo.outputPrice || 0) / 1_000_000) * outputTokens
	const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
	return totalCost
}

// For Anthropic compliant usage, the input tokens count does NOT include the
// cached tokens.
export function calculateApiCostAnthropic(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
): number {
	return calculateApiCostInternal(
		modelInfo,
		inputTokens,
		outputTokens,
		cacheCreationInputTokens || 0,
		cacheReadInputTokens || 0,
	)
}

// For OpenAI compliant usage, the input tokens count INCLUDES the cached tokens.
export function calculateApiCostOpenAI(
	modelInfo: ModelInfo,
	inputTokens: number,
	outputTokens: number,
	cacheCreationInputTokens?: number,
	cacheReadInputTokens?: number,
	serviceTier?: "auto" | "default" | "flex",
): number {
	const cacheCreationInputTokensNum = cacheCreationInputTokens || 0
	const cacheReadInputTokensNum = cacheReadInputTokens || 0
	const nonCachedInputTokens = Math.max(0, inputTokens - cacheCreationInputTokensNum - cacheReadInputTokensNum)

	// If flex tier selected and model indicates support for OpenAI flex tier, prefer the tier pricing
	let pricingInfo = modelInfo
	if (serviceTier === "flex" && modelInfo.supportsOpenAiFlexTier && modelInfo.tiers && modelInfo.tiers.length > 0) {
		// Only apply an explicitly named 'flex' tier. No fallback to other tiers.
		const named = modelInfo.tiers.find((t) => t.name === "flex")
		if (named) {
			pricingInfo = {
				...modelInfo,
				inputPrice: named.inputPrice ?? modelInfo.inputPrice,
				outputPrice: named.outputPrice ?? modelInfo.outputPrice,
				cacheWritesPrice: named.cacheWritesPrice ?? modelInfo.cacheWritesPrice,
				cacheReadsPrice: named.cacheReadsPrice ?? modelInfo.cacheReadsPrice,
			}
		}
	}

	return calculateApiCostInternal(
		pricingInfo,
		nonCachedInputTokens,
		outputTokens,
		cacheCreationInputTokensNum,
		cacheReadInputTokensNum,
	)
}

export const parseApiPrice = (price: any) => (price ? parseFloat(price) * 1_000_000 : undefined)
