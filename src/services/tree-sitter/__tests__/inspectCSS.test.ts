import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { cssQuery } from "../queries"
import sampleCSSContent from "./fixtures/sample-css"

describe("inspectCSS", () => {
	const testOptions = {
		language: "css",
		wasmFile: "tree-sitter-css.wasm",
		queryString: cssQuery,
		extKey: "css",
		debug: true,
	}

	it("should inspect CSS tree structure", async () => {
		await inspectTreeStructure(sampleCSSContent, "css")
	})

	it("should parse CSS definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.css", sampleCSSContent, testOptions)
		if (!result) {
			throw new Error("No result returned from parser")
		}
	})
})
