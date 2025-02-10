// npx jest src/services/deep-research/__tests__/text-splitter.test.ts

import { RecursiveCharacterTextSplitter } from "../text-splitter"

describe("RecursiveCharacterTextSplitter", () => {
	let splitter: RecursiveCharacterTextSplitter

	beforeEach(() => {
		splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 50,
			chunkOverlap: 10,
		})
	})

	it("Should correctly split text by separators", () => {
		const text = "Hello world, this is a test of the recursive text splitter."

		// Test with initial chunkSize
		expect(splitter.splitText(text)).toEqual(["Hello world", "this is a test of the recursive text splitter"])

		// Test with updated chunkSize
		splitter.chunkSize = 100
		expect(
			splitter.splitText(
				"Hello world, this is a test of the recursive text splitter. If I have a period, it should split along the period.",
			),
		).toEqual([
			"Hello world, this is a test of the recursive text splitter",
			"If I have a period, it should split along the period.",
		])

		// Test with another updated chunkSize
		splitter.chunkSize = 110
		expect(
			splitter.splitText(
				"Hello world, this is a test of the recursive text splitter. If I have a period, it should split along the period.\nOr, if there is a new line, it should prioritize splitting on new lines instead.",
			),
		).toEqual([
			"Hello world, this is a test of the recursive text splitter",
			"If I have a period, it should split along the period.",
			"Or, if there is a new line, it should prioritize splitting on new lines instead.",
		])
	})

	it("Should handle empty string", () => {
		expect(splitter.splitText("")).toEqual([])
	})

	it("Should handle special characters and large texts", () => {
		const largeText = "A".repeat(1000)
		splitter.chunkSize = 200
		expect(splitter.splitText(largeText)).toEqual(Array(5).fill("A".repeat(200)))

		const specialCharText = "Hello!@# world$%^ &*( this) is+ a-test"
		expect(splitter.splitText(specialCharText)).toEqual(["Hello!@#", "world$%^", "&*( this)", "is+", "a-test"])
	})

	it("Should handle chunkSize equal to chunkOverlap", () => {
		splitter.chunkSize = 50
		splitter.chunkOverlap = 50
		expect(() => splitter.splitText("Invalid configuration")).toThrow(
			new Error("Cannot have chunkOverlap >= chunkSize"),
		)
	})
})
