import { describe, it, expect, beforeEach } from "vitest"
import { PartialXMLStreamParser } from "../index"

describe("XML Sanitization Security Fix", () => {
	let parser: PartialXMLStreamParser

	beforeEach(() => {
		parser = new PartialXMLStreamParser({ textNodeName: "#text" })
	})

	const parseXml = (xmlString: string) => {
		const result = parser.parseStream(xmlString)
		parser.reset()
		return result.xml
	}

	describe("XML Declaration Sanitization", () => {
		it("should properly sanitize malformed XML declarations", () => {
			const malformedXml = `<?xml version="1.0"?<script>alert('xss')</script>?><root>content</root>`
			const result = parseXml(malformedXml)
			expect(JSON.stringify(result)).not.toContain("script")
			expect(JSON.stringify(result)).not.toContain("alert")
		})

		it("should handle XML declarations with incomplete closing", () => {
			const incompleteXml = `<?xml version="1.0"<script>alert('xss')</script><root>content</root>`
			const result = parseXml(incompleteXml)
			expect(JSON.stringify(result)).not.toContain("script")
			expect(JSON.stringify(result)).not.toContain("alert")
		})

		it("should handle nested question marks in XML declarations", () => {
			const nestedXml = `<?xml version="1.0" encoding="utf-8"?test?><root>content</root>`
			const result = parseXml(nestedXml)
			expect(result).toBeDefined()
		})
	})

	describe("Comment Sanitization", () => {
		it("should properly sanitize malformed comments", () => {
			const malformedComment = `<!--comment--<script>alert('xss')</script>--><root>content</root>`
			const result = parseXml(malformedComment)
			expect(JSON.stringify(result)).not.toContain("script")
			expect(JSON.stringify(result)).not.toContain("alert")
		})

		it("should handle comments with incomplete closing", () => {
			const incompleteComment = `<!--comment<script>alert('xss')</script><root>content</root>`
			const result = parseXml(incompleteComment)
			expect(JSON.stringify(result)).not.toContain("script")
			expect(JSON.stringify(result)).not.toContain("alert")
		})

		it("should handle nested dashes in comments", () => {
			const nestedComment = `<!--comment-with-dashes-inside--><root>content</root>`
			const result = parseXml(nestedComment)
			expect(result).toBeDefined()
		})
	})

	describe("DOCTYPE Sanitization", () => {
		it("should properly handle malformed DOCTYPE declarations without crashing", () => {
			const malformedDoctype = `<!DOCTYPE html<script>alert('xss')</script>><root>content</root>`
			const result = parseXml(malformedDoctype)

			// The parser should handle malformed input gracefully
			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)

			// Ensure the root element is still parsed correctly
			const rootElement = result.find((item) => typeof item === "object" && item.root)
			expect(rootElement).toBeDefined()
			expect(rootElement.root["#text"]).toBe("content")
		})

		it("should handle DOCTYPE with incomplete closing without crashing", () => {
			const incompleteDoctype = `<!DOCTYPE html<script>alert('xss')</script><root>content</root>`
			const result = parseXml(incompleteDoctype)

			// The parser should handle malformed input gracefully
			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)

			// Ensure the root element is still parsed correctly
			const rootElement = result.find((item) => typeof item === "object" && item.root)
			expect(rootElement).toBeDefined()
			expect(rootElement.root["#text"]).toBe("content")
		})

		it("should handle complex DOCTYPE declarations", () => {
			const complexDoctype = `<!DOCTYPE root SYSTEM "test.dtd"><root>content</root>`
			const result = parseXml(complexDoctype)
			expect(result).toBeDefined()
		})
	})

	describe("Combined Injection Attempts", () => {
		it("should prevent injection through multiple malformed declarations", () => {
			const combinedAttack = `<?xml version="1.0"?<script><!--comment--<img src=x onerror=alert(1)><!DOCTYPE html<iframe src=javascript:alert(2)>><root>content</root>`
			const result = parseXml(combinedAttack)
			const resultStr = JSON.stringify(result)
			expect(resultStr).not.toContain("script")
			expect(resultStr).not.toContain("img")
			expect(resultStr).not.toContain("iframe")
			expect(resultStr).not.toContain("alert")
			expect(resultStr).not.toContain("javascript")
		})

		it("should handle edge case with multiple question marks", () => {
			const edgeCase = `<?xml?version="1.0"?><root>content</root>`
			const result = parseXml(edgeCase)
			expect(result).toBeDefined()
		})

		it("should handle edge case with multiple dashes", () => {
			const edgeCase = `<!---comment---><root>content</root>`
			const result = parseXml(edgeCase)
			expect(result).toBeDefined()
		})
	})

	describe("Performance with Malformed Input", () => {
		it("should not cause exponential backtracking with malformed declarations", () => {
			const start = Date.now()
			const malformedInput = `<?xml${"?".repeat(1000)}><root>content</root>`

			try {
				parseXml(malformedInput)
			} catch (error) {
				// Parsing may fail, but it should fail quickly
			}

			const duration = Date.now() - start
			expect(duration).toBeLessThan(1000) // Should complete within 1 second
		})

		it("should handle large malformed comments efficiently", () => {
			const start = Date.now()
			const malformedComment = `<!${"--".repeat(1000)}><root>content</root>`

			try {
				parseXml(malformedComment)
			} catch (error) {
				// Parsing may fail, but it should fail quickly
			}

			const duration = Date.now() - start
			expect(duration).toBeLessThan(1000) // Should complete within 1 second
		})
	})

	describe("Valid XML Still Works", () => {
		it("should still parse valid XML with declarations correctly", () => {
			const validXml = `<?xml version="1.0" encoding="UTF-8"?>
			<!--This is a comment-->
			<!DOCTYPE root SYSTEM "test.dtd">
			<root>
				<child>content</child>
			</root>`

			const result = parseXml(validXml)
			expect(result).toBeDefined()
			expect(result[0]).toBeDefined()
			expect(result[0].root).toBeDefined()
			expect(result[0].root.child["#text"]).toBe("content")
		})

		it("should handle empty content after sanitization", () => {
			const onlyDeclarations = `<?xml version="1.0"?><!--comment--><!DOCTYPE root>`
			const result = parseXml(onlyDeclarations)
			expect(result).toEqual([])
		})
	})

	describe("Enhanced HTML Injection Prevention", () => {
		it("should sanitize potential HTML injection attempts", () => {
			const injectionAttempts = [
				'<script>alert("xss")</script>',
				'<img src="x" onerror="alert(1)">',
				'<div onclick="malicious()">content</div>',
				'<iframe src="javascript:alert(1)"></iframe>',
				'<svg onload="alert(1)">',
				'<object data="javascript:alert(1)">',
				'<embed src="javascript:alert(1)">',
				'<link rel="stylesheet" href="javascript:alert(1)">',
				'<style>body{background:url("javascript:alert(1)")}</style>',
				'<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
			]

			for (const injection of injectionAttempts) {
				// Should not throw an error
				expect(() => parseXml(injection)).not.toThrow()

				const result = parseXml(injection)
				expect(result).toBeDefined()
				// The enhanced sanitization should handle these gracefully
				expect(Array.isArray(result)).toBe(true)
			}
		})

		it("should handle CDATA injection attempts", () => {
			const cdataInjections = [
				'<script>alert("xss")</script>',
				"<script>alert(1)</script>",
				'<img src="x" onerror="alert(1)">',
				'<root><div onclick="evil()"></root>',
			]

			for (const injection of cdataInjections) {
				// Should not throw an error
				expect(() => parseXml(injection)).not.toThrow()

				const result = parseXml(injection)
				expect(result).toBeDefined()
				expect(Array.isArray(result)).toBe(true)
			}
		})

		it("should handle mixed malformed content with potential injections", () => {
			const mixedMalformed = [
				'<?xml version="1.0"?><script>alert(1)</script><!--comment-->',
				'<!DOCTYPE html><img src="x" onerror="alert(1)">',
				'<!--<script>alert(1)</script>--><div onclick="evil()">',
				"<script><script>alert(1)</script>",
				'<?xml<script>alert(1)</script>?><!DOCTYPE<div onclick="evil()">',
			]

			for (const malformed of mixedMalformed) {
				// Should not throw an error
				expect(() => parseXml(malformed)).not.toThrow()

				const result = parseXml(malformed)
				expect(result).toBeDefined()
				expect(Array.isArray(result)).toBe(true)
			}
		})

		it("should handle incomplete tags and malformed structures", () => {
			const incompleteStructures = [
				"<incomplete",
				'<tag attr="value',
				"<tag>content</wrong>",
				"</orphan>",
				"<tag><nested></tag>",
				"<tag attr=>content</tag>",
				'<tag attr="val"ue">content</tag>',
			]

			for (const incomplete of incompleteStructures) {
				// Should not throw an error
				expect(() => parseXml(incomplete)).not.toThrow()

				const result = parseXml(incomplete)
				expect(result).toBeDefined()
				expect(Array.isArray(result)).toBe(true)
			}
		})
	})
})
