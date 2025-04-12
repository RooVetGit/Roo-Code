import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import sampleTsxContent from "./fixtures/sample-tsx"

describe("inspectTsx", () => {
	const testOptions = {
		language: "tsx",
		wasmFile: "tree-sitter-tsx.wasm",
	}

	it("should inspect TSX tree structure", async () => {
		await inspectTreeStructure(sampleTsxContent, "tsx")
	})

	it("should parse TSX definitions", async () => {
		await testParseSourceCodeDefinitions("test.tsx", sampleTsxContent, testOptions)
	})
})
