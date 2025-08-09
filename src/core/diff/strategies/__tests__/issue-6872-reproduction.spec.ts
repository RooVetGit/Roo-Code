import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("Issue #6872 - apply_diff Tool Fails with Unicode Emoji Characters", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy(1.0) // Exact matching (100% threshold)
	})

	it("should handle the exact scenario from issue #6872", async () => {
		// This is the exact test case from the issue report
		const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

		const diffContent = `<<<<<<< SEARCH
**✔ This is a test line.**
=======
**This line has been successfully modified.**
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		// The issue reports this should fail with 99% match, but we expect it to work
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`# Test File

**This line has been successfully modified.**

Some other content.`)
		}
	})

	it("should handle the exact scenario with start_line from issue #6872", async () => {
		const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

		const diffContent = `<<<<<<< SEARCH
:start_line:3
-------
**✔ This is a test line.**
=======
**This line has been successfully modified.**
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`# Test File

**This line has been successfully modified.**

Some other content.`)
		}
	})

	it("should handle checkmark emoji with different normalization settings", async () => {
		// Test with 90% threshold to see if normalization affects matching
		const fuzzyStrategy = new MultiSearchReplaceDiffStrategy(0.9)

		const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

		const diffContent = `<<<<<<< SEARCH
**✔ This is a test line.**
=======
**This line has been successfully modified.**
>>>>>>> REPLACE`

		const result = await fuzzyStrategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`# Test File

**This line has been successfully modified.**

Some other content.`)
		}
	})

	it("should provide helpful error message if emoji causes mismatch", async () => {
		const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

		// Intentionally use a different emoji to test error handling
		const diffContent = `<<<<<<< SEARCH
**✅ This is a test line.**
=======
**This line has been successfully modified.**
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		// This should fail because the emojis don't match
		expect(result.success).toBe(false)
		if (!result.success && result.error) {
			expect(result.error).toContain("No sufficiently similar match found")
			expect(result.error).toContain("100%") // Should mention the threshold
		}
	})
})
