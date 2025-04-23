import { describe, it, beforeAll, beforeEach } from "@jest/globals"
import { testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import { cssQuery } from "../queries"
import sampleCSSContent from "./fixtures/sample-css"

describe("parseSourceCodeDefinitionsForFile with CSS", () => {
	const testOptions = {
		language: "css",
		wasmFile: "tree-sitter-css.wasm",
		queryString: cssQuery,
		extKey: "css",
		debug: true,
	}

	let parseResult: string | undefined

	beforeAll(async () => {
		// Cache parse result for all tests
		parseResult = await testParseSourceCodeDefinitions("test.css", sampleCSSContent, testOptions)
		if (!parseResult) {
			throw new Error("No result returned from parser")
		}
		debugLog("CSS Parse Result:", parseResult)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test for tree structure inspection
	it("should inspect CSS tree structure", async () => {
		await inspectTreeStructure(sampleCSSContent, "css")
	})

	// Test keyframe definitions
	it("should capture keyframe definitions", () => {
		if (!parseResult?.includes("test-keyframe-definition-fade")) {
			throw new Error("Keyframe definition not found")
		}
	})
})
