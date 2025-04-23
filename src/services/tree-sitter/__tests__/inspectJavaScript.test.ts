import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { javascriptQuery } from "../queries"
import sampleJavaScriptContent from "./fixtures/sample-javascript"

describe("inspectJavaScript", () => {
	const testOptions = {
		language: "javascript",
		wasmFile: "tree-sitter-javascript.wasm",
		queryString: javascriptQuery,
		extKey: "js",
	}

	it("should inspect JavaScript tree structure", async () => {
		await inspectTreeStructure(sampleJavaScriptContent, "javascript")
	})

	it("should parse JavaScript definitions", async () => {
		await testParseSourceCodeDefinitions("test.js", sampleJavaScriptContent, testOptions)
	})
})
