import { normalizeString, unescapeHtmlEntities } from "../text-normalization"

describe("Text normalization utilities", () => {
	describe("normalizeString", () => {
		it("normalizes smart quotes by default", () => {
			expect(normalizeString("These are \u201Csmart quotes\u201D and \u2018single quotes\u2019")).toBe(
				"These are \"smart quotes\" and 'single quotes'",
			)
		})

		it("normalizes typographic characters by default", () => {
			expect(normalizeString("This has an em dash \u2014 and ellipsis\u2026")).toBe(
				"This has an em dash - and ellipsis...",
			)
		})

		it("normalizes whitespace by default", () => {
			expect(normalizeString("Multiple   spaces and\t\ttabs")).toBe("Multiple spaces and tabs")
		})

		it("can be configured to skip certain normalizations", () => {
			const input = "Keep \u201Csmart quotes\u201D but normalize   whitespace"
			expect(normalizeString(input, { smartQuotes: false })).toBe(
				"Keep \u201Csmart quotes\u201D but normalize whitespace",
			)
		})

		it("real-world example with mixed characters", () => {
			const input = "Let\u2019s test this\u2014with some \u201Cfancy\u201D punctuation\u2026 and   spaces"
			expect(normalizeString(input)).toBe('Let\'s test this-with some "fancy" punctuation... and spaces')
		})
	})

	describe("unescapeHtmlEntities", () => {
		it("unescapes basic HTML entities", () => {
			expect(unescapeHtmlEntities("&lt;div&gt;Hello&lt;/div&gt;")).toBe("<div>Hello</div>")
		})

		it("unescapes ampersand entity", () => {
			expect(unescapeHtmlEntities("This &amp; that")).toBe("This & that")
		})

		it("unescapes quote entities", () => {
			expect(unescapeHtmlEntities("&quot;quoted&quot; and &#39;single-quoted&#39;")).toBe(
				"\"quoted\" and 'single-quoted'",
			)
		})

		it("unescapes apostrophe entity", () => {
			expect(unescapeHtmlEntities("Don&apos;t worry")).toBe("Don't worry")
		})

		it("handles mixed content with multiple entity types", () => {
			expect(
				unescapeHtmlEntities(
					"&lt;a href=&quot;https://example.com?param1=value&amp;param2=value&quot;&gt;Link&lt;/a&gt;",
				),
			).toBe('<a href="https://example.com?param1=value&param2=value">Link</a>')
		})

		it("handles mixed content with apostrophe entities", () => {
			expect(
				unescapeHtmlEntities(
					"&lt;div&gt;Don&apos;t forget that Tom&amp;Jerry&apos;s show is at 3 o&apos;clock&lt;/div&gt;",
				),
			).toBe("<div>Don't forget that Tom&Jerry's show is at 3 o'clock</div>")
		})

		it("returns original string when no entities are present", () => {
			const original = "Plain text without entities"
			expect(unescapeHtmlEntities(original)).toBe(original)
		})

		it("handles empty or undefined input", () => {
			expect(unescapeHtmlEntities("")).toBe("")
			expect(unescapeHtmlEntities(undefined as unknown as string)).toBe(undefined)
		})

		// Issue #4077 - HTML entity handling verification
		it("should demonstrate that unescapeHtmlEntities converts &amp; to &", () => {
			const input = "// Step 5 &amp; 6: Verify the data"
			const result = unescapeHtmlEntities(input)

			expect(result).toBe("// Step 5 & 6: Verify the data")
			expect(result).not.toBe(input)
			expect(result).not.toContain("&amp;")
			expect(result).toContain("&")
		})

		it("should show the exact problem from issue #4077", () => {
			// The user's SEARCH block content (what they see in their file)
			const searchContent = "// Adım 5 &amp; 6: İşaret edilen verinin bölümünü bul ve doğrula"

			// After unescaping (what happens for non-Claude models)
			const unescapedSearch = unescapeHtmlEntities(searchContent)

			// The actual file content (contains HTML entity)
			const fileContent = "// Adım 5 &amp; 6: İşaret edilen verinin bölümünü bul ve doğrula"

			// This demonstrates the mismatch
			expect(unescapedSearch).toBe("// Adım 5 & 6: İşaret edilen verinin bölümünü bul ve doğrula")
			expect(unescapedSearch).not.toBe(fileContent)

			// The key issue: when searching for the unescaped version in the file content
			// it won't find a match because the file has &amp; but we're searching for &
			const willFindMatch = fileContent.includes(unescapedSearch)
			expect(willFindMatch).toBe(false)

			// But if we search for the original (not unescaped), it would work
			const wouldFindMatchWithoutUnescape = fileContent.includes(searchContent)
			expect(wouldFindMatchWithoutUnescape).toBe(true)
		})

		it("should verify all HTML entities are unescaped", () => {
			const testCases = [
				{ input: "&lt;", expected: "<" },
				{ input: "&gt;", expected: ">" },
				{ input: "&quot;", expected: '"' },
				{ input: "&#39;", expected: "'" },
				{ input: "&apos;", expected: "'" },
				{ input: "&amp;", expected: "&" },
			]

			testCases.forEach(({ input, expected }) => {
				expect(unescapeHtmlEntities(input)).toBe(expected)
			})
		})
	})
})
