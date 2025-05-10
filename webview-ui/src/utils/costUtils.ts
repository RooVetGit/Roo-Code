import { ClineMessage } from "@roo/shared/ExtensionMessage"

export interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
	tokensIn?: number
	tokensOut?: number
	cacheReads?: number
	cacheWrites?: number
}

export function calculateCostHistory(messages: ClineMessage[]): CostHistoryDataPoint[] {
	let cumulativeCost = 0
	let requestIndex = 0
	const history: CostHistoryDataPoint[] = []

	messages.forEach((message) => {
		if (message.say === "api_req_started" && message.text) {
			try {
				const data = JSON.parse(message.text)
				if (data.cost !== undefined && data.cost !== null) {
					const costDelta = data.cost ?? 0
					cumulativeCost += costDelta
					requestIndex++

					history.push({
						requestIndex,
						cumulativeCost,
						costDelta,
						tokensIn: data.tokensIn,
						tokensOut: data.tokensOut,
						cacheReads: data.cacheReads,
						cacheWrites: data.cacheWrites,
					})
				}
			} catch (e) {
				console.error("Error parsing api_req_started text for cost history:", e, message.text)
			}
		}
	})
	return history
}
