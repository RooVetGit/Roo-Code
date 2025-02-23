import { DeepResearchModel } from "./types"

export const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function formatCurrency(value: number) {
	return currencyFormatter.format(value)
}

export function formatCost(inTokens: number, outTokens: number, model: DeepResearchModel) {
	const costIn = (inTokens / 1_000_000) * model.inputPrice
	const costOut = (outTokens / 1_000_000) * model.outputPrice
	return formatCurrency(costIn + costOut)
}

export function formatTokenCount(tokens: number) {
	return (tokens < 100_000 ? (tokens / 1000).toFixed(1) : Math.round(tokens / 1000)) + "K"
}

export const toSentenceCase = (value?: string) =>
	value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : undefined
