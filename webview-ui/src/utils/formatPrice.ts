export const formatPrice = (price: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 3, //E.g. for Cache reads price: $0.003 / 1M tokens for GPT-5 Nano with flex pricing
	}).format(price)
}
