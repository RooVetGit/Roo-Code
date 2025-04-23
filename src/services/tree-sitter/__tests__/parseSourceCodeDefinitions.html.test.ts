import { describe, it, expect } from "@jest/globals"
import { sampleHtmlContent } from "./fixtures/sample-html"
import { htmlQuery } from "../queries"
import { testParseSourceCodeDefinitions } from "./helpers"

describe("parseSourceCodeDefinitions HTML", () => {
	const testOptions = {
		language: "html",
		wasmFile: "tree-sitter-html.wasm",
		queryString: htmlQuery,
		extKey: "html",
	}

	let result: string

	beforeAll(async () => {
		// Cache the result since parsing can be slow
		const parseResult = await testParseSourceCodeDefinitions("test.html", sampleHtmlContent, testOptions)
		if (!parseResult) {
			throw new Error("Failed to parse HTML content")
		}
		result = parseResult
	})

	it("should capture all HTML structures", () => {
		// Document and doctype
		expect(result).toMatch(/1--88 \| <!DOCTYPE html>/)
		expect(result).toMatch(/2--88 \| <html lang="en">/)

		// Head section elements
		expect(result).toMatch(/3--9 \| <head>/)
		expect(result).toMatch(/5--8 \|     <meta name="viewport"/)

		// Body section
		expect(result).toMatch(/10--87 \| <body>/)

		// Comments
		expect(result).toMatch(/12--15 \|     <!-- Multi-line comment structure/)

		// Elements with attributes
		expect(result).toMatch(/17--22 \|     <div class="test-element"/)
		expect(result).toMatch(/24--30 \|     <div class="test-attribute"/)

		// Script and style elements
		expect(result).toMatch(/32--37 \|     <script type="text\/javascript">/)
		expect(result).toMatch(/39--45 \|     <style type="text\/css">/)

		// Text nodes
		expect(result).toMatch(/47--52 \|     <div class="test-text">/)
		expect(result).toMatch(/48--51 \|         This is a text node/)

		// Fragment elements
		expect(result).toMatch(/54--59 \|     <div class="test-fragment">/)

		// Void elements
		expect(result).toMatch(/61--66 \|     <img src="test.jpg"/)

		// Raw text elements
		expect(result).toMatch(/68--75 \|     <div class="test-raw-text">/)
		expect(result).toMatch(/69--74 \|         <pre>/)
		expect(result).toMatch(/70--73 \|             Raw text content/)

		// Nested elements
		expect(result).toMatch(/77--85 \|     <div class="test-nested">/)
		expect(result).toMatch(/78--84 \|         <div class="level-1">/)
		expect(result).toMatch(/79--83 \|             <div class="level-2">/)
	})
})
