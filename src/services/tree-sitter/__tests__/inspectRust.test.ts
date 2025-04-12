import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { rustQuery } from "../queries"
import sampleRustContent from "./fixtures/sample-rust"

describe("inspectRust", () => {
	const testOptions = {
		language: "rust",
		wasmFile: "tree-sitter-rust.wasm",
		queryString: rustQuery,
		extKey: "rs",
	}

	it("should inspect Rust tree structure", async () => {
		await inspectTreeStructure(sampleRustContent, "rust")
	})

	it("should parse Rust definitions", async () => {
		await testParseSourceCodeDefinitions("test.rs", sampleRustContent, testOptions)
	})
})
