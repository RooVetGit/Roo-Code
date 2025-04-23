import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { elixirQuery } from "../queries"
import sampleElixirContent from "./fixtures/sample-elixir"

describe("inspectElixir", () => {
	const testOptions = {
		language: "elixir",
		wasmFile: "tree-sitter-elixir.wasm",
		queryString: elixirQuery,
		extKey: "ex",
	}

	it("should inspect Elixir tree structure", async () => {
		await inspectTreeStructure(sampleElixirContent, "elixir")
	})

	it("should parse Elixir definitions", async () => {
		await testParseSourceCodeDefinitions("test.ex", sampleElixirContent, testOptions)
	})
})
