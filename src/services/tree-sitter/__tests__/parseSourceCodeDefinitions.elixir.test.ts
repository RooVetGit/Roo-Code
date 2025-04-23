import { describe, expect, it, jest, beforeAll, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { elixirQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleElixirContent from "./fixtures/sample-elixir"

// Elixir test options
const elixirOptions = {
	language: "elixir",
	wasmFile: "tree-sitter-elixir.wasm",
	queryString: elixirQuery,
	extKey: "ex",
}

// Mock file system operations
jest.mock("fs/promises")
const mockedFs = jest.mocked(fs)

// Mock loadRequiredLanguageParsers
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))

// Mock fileExistsAtPath to return true for our test paths
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

describe("parseSourceCodeDefinitionsForFile with Elixir", () => {
	let parseResult: string = ""

	beforeAll(async () => {
		// Cache parse result for all tests
		parseResult = await testParseSourceCodeDefinitions("/test/file.ex", sampleElixirContent, elixirOptions)
		debugLog("Elixir Parse Result:", parseResult)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test for tree structure inspection
	it("should inspect Elixir tree structure", async () => {
		await inspectTreeStructure(sampleElixirContent, "elixir")
	})

	// Test module definitions
	it("should capture module definitions", () => {
		expect(parseResult).toContain("TestModuleDefinition")
		expect(parseResult).toContain("TestBehaviourDefinition")
		expect(parseResult).toContain("TestModuleDefinitionTest")
	})

	// Test function definitions
	it("should capture function definitions", () => {
		expect(parseResult).toContain("test_function_definition")
		expect(parseResult).toContain("test_pipeline_definition")
		expect(parseResult).toContain("test_comprehension_definition")
		expect(parseResult).toContain("test_sigil_definition")
	})

	// Test macro definitions
	it("should capture macro definitions", () => {
		expect(parseResult).toContain("test_macro_definition")
	})

	// Test protocol and implementation definitions
	it("should capture protocol and implementation definitions", () => {
		expect(parseResult).toContain("String.Chars")
		expect(parseResult).toContain("TestModuleDefinition")
	})

	// Test behaviour definitions
	it("should capture behaviour definitions", () => {
		expect(parseResult).toContain("test_behaviour_callback")
	})

	// Test struct definitions
	it("should capture struct definitions", () => {
		expect(parseResult).toContain("defstruct [")
	})

	// Test guard definitions
	it("should capture guard definitions", () => {
		expect(parseResult).toContain("test_guard_definition")
	})

	// Test sigil definitions
	it("should capture sigil definitions", () => {
		expect(parseResult).toContain("~s")
	})

	// Test attribute definitions
	it("should capture attribute definitions", () => {
		expect(parseResult).toContain("@test_attribute_definition")
		expect(parseResult).toContain("@moduledoc")
	})

	// Test test definitions
	it("should capture test definitions", () => {
		expect(parseResult).toContain("test_definition")
	})
})
