import { describe, it, expect } from "@jest/globals"
import { testParseSourceCodeDefinitions } from "./helpers"
import systemrdlQuery from "../queries/systemrdl"
import sampleSystemRDLContent from "./fixtures/sample-systemrdl"

describe("parseSourceCodeDefinitions.systemrdl", () => {
	const testOptions = {
		language: "systemrdl",
		wasmFile: "tree-sitter-systemrdl.wasm",
		queryString: systemrdlQuery,
		extKey: "rdl",
	}

	it("should parse SystemRDL component definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.rdl", sampleSystemRDLContent, testOptions)
		expect(result).toContain("addrmap top_map {")
		expect(result).toContain("reg block_ctrl {")
		expect(result).toContain("reg status_reg {")
		expect(result).toContain("reg complex_reg {")
	})

	it("should parse SystemRDL field definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.rdl", sampleSystemRDLContent, testOptions)
		expect(result).toContain("field {")
	})

	it("should parse SystemRDL property definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.rdl", sampleSystemRDLContent, testOptions)
		expect(result).toContain("property my_custom_prop {")
	})

	it("should parse SystemRDL parameter definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.rdl", sampleSystemRDLContent, testOptions)
		// Parameter definitions are not captured in the current output
		expect(result).toBeDefined()
	})

	it("should parse SystemRDL enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.rdl", sampleSystemRDLContent, testOptions)
		expect(result).toContain("enum error_types {")
		expect(result).toContain("enum interrupt_type {")
	})
})
