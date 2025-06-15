import { describe, it, expect } from "vitest"
import { STATIC_OPENING_TAG_REGEX } from "../constants"

describe("ReDoS vulnerability fix", () => {
	it("should handle problematic input patterns without exponential backtracking", () => {
		// Test the specific pattern mentioned in the vulnerability report
		const problematicInput = "<-\t-=" + '""\t-='.repeat(20)

		const startTime = Date.now()
		const result = STATIC_OPENING_TAG_REGEX.exec(problematicInput)
		const endTime = Date.now()

		// The regex should fail quickly (not match) without taking excessive time
		expect(result).toBeNull()
		expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
	})

	it("should still correctly match valid opening tags", () => {
		const validInputs = [
			"<div>",
			'<div class="test">',
			'<div class="test" id="example">',
			'<div class="test" id="example" />',
			'<my-component attr="value">',
			'<tag attr1="val1" attr2="val2" attr3="val3">',
			"<self-closing/>",
			'<tag attr="value with spaces">',
			"<tag attr='single quotes'>",
			"<tag attr=unquoted>",
			"<tag boolean-attr>",
		]

		validInputs.forEach((input) => {
			const result = STATIC_OPENING_TAG_REGEX.exec(input)
			expect(result).not.toBeNull()
			expect(result![0]).toBe(input)
		})
	})

	it("should handle edge cases without performance issues", () => {
		const edgeCases = [
			"<",
			"<>",
			"<tag",
			"<tag attr",
			"<tag attr=",
			'<tag attr="',
			'<tag attr="unclosed',
			'<tag attr="val" attr2',
			'<tag attr="val" attr2=',
			'<tag attr="val" attr2="',
		]

		edgeCases.forEach((input) => {
			const startTime = Date.now()
			const result = STATIC_OPENING_TAG_REGEX.exec(input)
			const endTime = Date.now()

			// Should complete quickly regardless of result
			expect(endTime - startTime).toBeLessThan(50)
		})
	})

	it("should handle repeated problematic patterns", () => {
		// Test various repetitions of the problematic pattern
		for (let i = 1; i <= 50; i += 10) {
			const input = "<-\t-=" + '""\t-='.repeat(i)

			const startTime = Date.now()
			const result = STATIC_OPENING_TAG_REGEX.exec(input)
			const endTime = Date.now()

			expect(result).toBeNull()
			expect(endTime - startTime).toBeLessThan(100)
		}
	})
})
