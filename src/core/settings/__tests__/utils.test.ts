import { areArraysEqual } from "../utils"

describe("areArraysEqual", () => {
	it("returns true for identical arrays", () => {
		const arr1 = ["npm test", "git log"]
		const arr2 = ["npm test", "git log"]
		expect(areArraysEqual(arr1, arr2)).toBe(true)
	})

	it("returns true for arrays with same elements in different order", () => {
		const arr1 = ["npm test", "git log"]
		const arr2 = ["git log", "npm test"]
		expect(areArraysEqual(arr1, arr2)).toBe(true)
	})

	it("returns false for arrays with different elements", () => {
		const arr1 = ["npm test", "git log"]
		const arr2 = ["npm test", "git diff"]
		expect(areArraysEqual(arr1, arr2)).toBe(false)
	})

	it("returns true for empty arrays", () => {
		expect(areArraysEqual([], [])).toBe(true)
	})

	it("returns true for null/undefined inputs", () => {
		expect(areArraysEqual(null, null)).toBe(true)
		expect(areArraysEqual(undefined, undefined)).toBe(true)
	})

	it("returns false when one input is null/undefined", () => {
		expect(areArraysEqual(null, [])).toBe(false)
		expect(areArraysEqual([], undefined)).toBe(false)
	})
})
