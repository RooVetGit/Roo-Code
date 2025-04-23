import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { htmlQuery } from "../queries"
import { sampleHtmlContent } from "./fixtures/sample-html"

describe("inspectHtml", () => {
	const testOptions = {
		language: "html",
		wasmFile: "tree-sitter-html.wasm",
		queryString: htmlQuery,
		extKey: "html",
	}

	it("should inspect HTML tree structure", async () => {
		await inspectTreeStructure(sampleHtmlContent, "html")
	})

	it("should parse HTML definitions", async () => {
		await testParseSourceCodeDefinitions("test.html", sampleHtmlContent, testOptions)
	})
})
