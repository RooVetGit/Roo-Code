import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { cQuery } from "../queries"
import sampleCContent from "./fixtures/sample-c"

describe("inspectC", () => {
	const testOptions = {
		language: "c",
		wasmFile: "tree-sitter-c.wasm",
		queryString: cQuery,
		extKey: "c",
	}

	it("should inspect C tree structure", async () => {
		await inspectTreeStructure(sampleCContent, "c")
	})

	it("should parse C definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		expect(result).toBeDefined()
		expect(result).toContain("struct TestBasicStruct")
		expect(result).toContain("test_basic_function")
	})
})
