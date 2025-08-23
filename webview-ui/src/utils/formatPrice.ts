type FormatPriceOptions = {
	minFractionDigits?: number
	maxFractionDigits?: number
}

export const formatPrice = (price: number, opts?: FormatPriceOptions) => {
	const minDigits = opts?.minFractionDigits ?? 2
	const maxDigits = opts?.maxFractionDigits ?? 2
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: minDigits,
		maximumFractionDigits: maxDigits,
	}).format(price)
}
