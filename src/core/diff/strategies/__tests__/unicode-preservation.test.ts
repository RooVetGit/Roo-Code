import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("Unicode Character Preservation", () => {
	it("should preserve Unicode apostrophes when applying diffs", async () => {
		const strategy = new MultiSearchReplaceDiffStrategy(1.0) // Exact matching

		const originalContent = `This file contains Unicode apostrophes: \u2018hello\u2019 and \u201Cworld\u201D
Another line with Unicode: \u2018test\u2019 and \u201Cexample\u201D
Regular ASCII: 'normal' and "standard"`

		const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
This file contains Unicode apostrophes: 'hello' and "world"
=======
This file contains Unicode apostrophes: 'goodbye' and "universe"
\>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success && result.content) {
			// Check that Unicode characters are preserved
			expect(result.content).toContain("\u2018goodbye\u2019") // Should preserve Unicode apostrophe (U+2018/U+2019)
			expect(result.content).toContain("\u201Cuniverse\u201D") // Should preserve Unicode quotes (U+201C/U+201D)
			// Check that ASCII characters are NOT present (they should be converted to Unicode)
			expect(result.content).not.toContain("'goodbye'") // Should not have ASCII apostrophe
			expect(result.content).not.toContain('"universe"') // Should not have ASCII quotes
		}
	})

	it("should preserve Unicode quotes in multi-line replacements", async () => {
		const strategy = new MultiSearchReplaceDiffStrategy(1.0)

		const originalContent = `Line 1: \u2018unicode\u2019
Line 2: \u201Cquotes\u201D
Line 3: normal`

		const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
Line 1: 'unicode'
Line 2: "quotes"
=======
Line 1: 'modified'
Line 2: "changed"
\>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success && result.content) {
			expect(result.content).toContain("\u2018modified\u2019")
			expect(result.content).toContain("\u201Cchanged\u201D")
		}
	})

	it("should handle mixed Unicode and ASCII quotes correctly", async () => {
		const strategy = new MultiSearchReplaceDiffStrategy(1.0)

		const originalContent = `Unicode: \u2018test\u2019 and \u201Cexample\u201D
ASCII: 'normal' and "standard"`

		const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
Unicode: 'test' and "example"
=======
Unicode: 'replaced' and "modified"
\>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success && result.content) {
			// Should preserve Unicode in the replaced line
			expect(result.content).toContain("\u2018replaced\u2019")
			expect(result.content).toContain("\u201Cmodified\u201D")
			// Should keep ASCII in the unchanged line
			expect(result.content).toContain("'normal'")
			expect(result.content).toContain('"standard"')
		}
	})

	it("should not affect content when no Unicode characters are present", async () => {
		const strategy = new MultiSearchReplaceDiffStrategy(1.0)

		const originalContent = `Regular ASCII: 'test' and "example"`

		const diffContent = `<<<<<<< SEARCH
:start_line:1
-------
Regular ASCII: 'test' and "example"
=======
Regular ASCII: 'modified' and "changed"
\>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		expect(result.success).toBe(true)
		if (result.success && result.content) {
			expect(result.content).toBe(`Regular ASCII: 'modified' and "changed"`)
		}
	})
})
