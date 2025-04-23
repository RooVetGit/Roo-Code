import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { cppQuery } from "../queries"
import sampleCppContent from "./fixtures/sample-cpp"

describe("inspectCpp", () => {
	const testOptions = {
		language: "cpp",
		wasmFile: "tree-sitter-cpp.wasm",
		queryString: cppQuery,
		extKey: "cpp",
	}

	it("should inspect C++ tree structure", async () => {
		await inspectTreeStructure(sampleCppContent, "cpp")
	})

	it("should parse C++ definitions", async () => {
		await testParseSourceCodeDefinitions("test.cpp", sampleCppContent, testOptions)
	})
})
