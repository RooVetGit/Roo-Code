import { getWeightedThreshold } from "../multi-search-replace"

describe("getWeightedThreshold", () => {
	it("returns 1 for baseThreshold 1.0 and short text", () => {
		expect(getWeightedThreshold(1.0, 10)).toBe(1)
	})

	it("returns 1 for baseThreshold 1.0 and long text", () => {
		expect(getWeightedThreshold(1.0, 10000)).toBe(1)
	})

	it("returns baseThreshold for long text", () => {
		expect(getWeightedThreshold(0.95, 1000)).toBe(0.95)
	})

	it("returns baseThreshold for text length exactly 50", () => {
		expect(getWeightedThreshold(0.9, 50)).toBe(0.9)
	})

	it("returns baseThreshold - 0.1 for short text, but not below 0.8", () => {
		expect(getWeightedThreshold(0.9, 10)).toBe(0.8)
		expect(getWeightedThreshold(0.85, 10)).toBe(0.8)
		expect(getWeightedThreshold(0.95, 10)).toBe(0.85)
	})

	it("never goes below 0.8 for extreme values", () => {
		expect(getWeightedThreshold(0.8, 1)).toBe(0.8)
		expect(getWeightedThreshold(0.8, 100000)).toBe(0.8)
	})
})
