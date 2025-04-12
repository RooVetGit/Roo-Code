import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { swiftQuery } from "../queries"
import sampleSwiftContent from "./fixtures/sample-swift"

describe("inspectSwift", () => {
	const testOptions = {
		language: "swift",
		wasmFile: "tree-sitter-swift.wasm",
		queryString: swiftQuery,
		extKey: "swift",
	}

	it("should inspect Swift tree structure", async () => {
		await inspectTreeStructure(sampleSwiftContent, "swift")
	})

	it("should parse Swift definitions", async () => {
		await testParseSourceCodeDefinitions("test.swift", sampleSwiftContent, testOptions)
	})
})
