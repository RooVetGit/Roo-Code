import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { csharpQuery } from "../queries"
import sampleCSharpContent from "./fixtures/sample-c-sharp"

describe("inspectCSharp", () => {
	const testOptions = {
		language: "c_sharp",
		wasmFile: "tree-sitter-c_sharp.wasm",
		queryString: csharpQuery,
		extKey: "cs",
	}

	it("should inspect C# tree structure", async () => {
		await inspectTreeStructure(sampleCSharpContent, "c_sharp")
	})

	it("should parse C# definitions", async () => {
		await testParseSourceCodeDefinitions("test.cs", sampleCSharpContent, testOptions)
	})
})
