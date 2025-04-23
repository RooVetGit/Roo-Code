import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { typescriptQuery } from "../queries"
import sampleTypeScriptContent from "./fixtures/sample-typescript"

describe("inspectTypeScript", () => {
	const testOptions = {
		language: "typescript",
		wasmFile: "tree-sitter-typescript.wasm",
		queryString: typescriptQuery,
		extKey: "ts",
	}

	it("should inspect TypeScript tree structure", async () => {
		await inspectTreeStructure(sampleTypeScriptContent, "typescript")
	})

	it("should parse TypeScript definitions", async () => {
		await testParseSourceCodeDefinitions("test.ts", sampleTypeScriptContent, testOptions)
	})
})
