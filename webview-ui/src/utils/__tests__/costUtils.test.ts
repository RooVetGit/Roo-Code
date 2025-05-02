import { ClineMessage } from "@roo/shared/ExtensionMessage"
import { calculateCostHistory, CostHistoryDataPoint } from "../costUtils"

describe("calculateCostHistory", () => {
	const addTs = (msg: Omit<ClineMessage, "ts">, index: number): ClineMessage => ({
		...msg,
		ts: Date.now() + index,
	})

	it("should return an empty array for empty input", () => {
		const messages: ClineMessage[] = []
		expect(calculateCostHistory(messages)).toEqual([])
	})

	it("should return an empty array if no api_req_started messages exist", () => {
		const messages: ClineMessage[] = [
			addTs({ type: "say", say: "text", text: "Hello" }, 0),
			addTs({ type: "ask", ask: "followup", text: "How are you?" }, 1),
		]
		expect(calculateCostHistory(messages)).toEqual([])
	})

	it("should return an empty array if api_req_started messages have undefined text", () => {
		const messages: ClineMessage[] = [addTs({ type: "say", say: "api_req_started", text: undefined }, 0)]
		expect(calculateCostHistory(messages)).toEqual([])
	})

	it("should return an empty array if api_req_started messages have invalid JSON", () => {
		const messages: ClineMessage[] = [addTs({ type: "say", say: "api_req_started", text: "not json" }, 0)]
		const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
		expect(calculateCostHistory(messages)).toEqual([])
		expect(consoleErrorSpy).toHaveBeenCalled()
		consoleErrorSpy.mockRestore()
	})

	it("should return an empty array if api_req_started messages have no cost (incomplete)", () => {
		const messages: ClineMessage[] = [
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ tokensIn: 10 }) }, 0),
		]
		expect(calculateCostHistory(messages)).toEqual([])
	})

	it("should return an empty array if api_req_started messages have cost as null (incomplete)", () => {
		const messages: ClineMessage[] = [
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: null, tokensIn: 10 }) }, 0),
		]
		expect(calculateCostHistory(messages)).toEqual([])
	})

	it("should correctly calculate history for a single completed request", () => {
		const messages: ClineMessage[] = [
			addTs(
				{
					type: "say",
					say: "api_req_started",
					text: JSON.stringify({ cost: 0.01, tokensIn: 100, tokensOut: 50 }),
				},
				0,
			),
		]
		const expected: CostHistoryDataPoint[] = [
			{
				requestIndex: 1,
				cumulativeCost: 0.01,
				costDelta: 0.01,
				tokensIn: 100,
				tokensOut: 50,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
		]
		expect(calculateCostHistory(messages)).toEqual(expected)
	})

	it("should correctly calculate history for a single completed request with cost 0", () => {
		const messages: ClineMessage[] = [
			addTs(
				{ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0, tokensIn: 10, tokensOut: 5 }) },
				0,
			),
		]
		const expected: CostHistoryDataPoint[] = [
			{
				requestIndex: 1,
				cumulativeCost: 0,
				costDelta: 0,
				tokensIn: 10,
				tokensOut: 5,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
		]
		expect(calculateCostHistory(messages)).toEqual(expected)
	})

	it("should correctly calculate history for multiple completed requests", () => {
		const messages: ClineMessage[] = [
			addTs(
				{
					type: "say",
					say: "api_req_started",
					text: JSON.stringify({ cost: 0.01, tokensIn: 100, tokensOut: 50 }),
				},
				0,
			),
			addTs({ type: "say", say: "text", text: "Some response" }, 1),
			addTs(
				{
					type: "say",
					say: "api_req_started",
					text: JSON.stringify({ cost: 0.025, tokensIn: 200, tokensOut: 150, cacheReads: 1 }),
				},
				2,
			),
			addTs(
				{
					type: "say",
					say: "api_req_started",
					text: JSON.stringify({ cost: 0.005, tokensIn: 50, tokensOut: 20, cacheWrites: 1 }),
				},
				3,
			),
		]
		const expected: CostHistoryDataPoint[] = [
			{
				requestIndex: 1,
				cumulativeCost: 0.01,
				costDelta: 0.01,
				tokensIn: 100,
				tokensOut: 50,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
			{
				requestIndex: 2,
				cumulativeCost: 0.035,
				costDelta: 0.025,
				tokensIn: 200,
				tokensOut: 150,
				cacheReads: 1,
				cacheWrites: undefined,
			},
			{
				requestIndex: 3,
				cumulativeCost: 0.04,
				costDelta: 0.005,
				tokensIn: 50,
				tokensOut: 20,
				cacheReads: undefined,
				cacheWrites: 1,
			},
		]
		expect(calculateCostHistory(messages)).toEqual(expected)
	})

	it("should ignore incomplete requests mixed with complete ones", () => {
		const messages: ClineMessage[] = [
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0.01, tokensIn: 100 }) }, 0),
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ tokensIn: 200 }) }, 1),
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: null, tokensIn: 50 }) }, 2),
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0.03, tokensOut: 150 }) }, 3),
		]
		const expected: CostHistoryDataPoint[] = [
			{
				requestIndex: 1,
				cumulativeCost: 0.01,
				costDelta: 0.01,
				tokensIn: 100,
				tokensOut: undefined,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
			{
				requestIndex: 2,
				cumulativeCost: 0.04,
				costDelta: 0.03,
				tokensIn: undefined,
				tokensOut: 150,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
		]
		expect(calculateCostHistory(messages)).toEqual(expected)
	})

	it("should handle missing optional fields gracefully", () => {
		const messages: ClineMessage[] = [
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0.01 }) }, 0),
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0.02, tokensIn: 100 }) }, 1),
			addTs({ type: "say", say: "api_req_started", text: JSON.stringify({ cost: 0.03, cacheReads: 5 }) }, 2),
		]
		const expected: CostHistoryDataPoint[] = [
			{
				requestIndex: 1,
				cumulativeCost: 0.01,
				costDelta: 0.01,
				tokensIn: undefined,
				tokensOut: undefined,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
			{
				requestIndex: 2,
				cumulativeCost: 0.03,
				costDelta: 0.02,
				tokensIn: 100,
				tokensOut: undefined,
				cacheReads: undefined,
				cacheWrites: undefined,
			},
			{
				requestIndex: 3,
				cumulativeCost: 0.06,
				costDelta: 0.03,
				tokensIn: undefined,
				tokensOut: undefined,
				cacheReads: 5,
				cacheWrites: undefined,
			},
		]
		expect(calculateCostHistory(messages)).toEqual(expected)
	})
})
