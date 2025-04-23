import { describe, expect, it, jest, beforeAll, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { pythonQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import { samplePythonContent } from "./fixtures/sample-python"

// Python test options
const pythonOptions = {
	language: "python",
	wasmFile: "tree-sitter-python.wasm",
	queryString: pythonQuery,
	extKey: "py",
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

describe("parseSourceCodeDefinitionsForFile with Python", () => {
	let parseResult: string | undefined

	beforeAll(async () => {
		// Cache parse result for all tests
		parseResult = await testParseSourceCodeDefinitions("/test/file.py", samplePythonContent, pythonOptions)
		debugLog("Python Parse Result:", parseResult)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test for tree structure inspection
	it("should inspect Python tree structure", async () => {
		await inspectTreeStructure(samplePythonContent, "python")
	})

	// Test decorated class definitions
	it("should capture decorated class definitions", () => {
		expect(parseResult).toContain("MultiLineDecoratedClass")
	})

	// Test method definitions
	it("should capture method definitions", () => {
		expect(parseResult).toContain("multi_line_method")
	})

	// Test decorated async function definitions
	it("should capture decorated async function definitions", () => {
		expect(parseResult).toContain("multi_line_async_function")
	})

	// Test generator functions
	it("should capture generator functions", () => {
		expect(parseResult).toContain("multi_line_generator")
	})

	// Test lambda functions
	it("should capture lambda functions", () => {
		expect(parseResult).toContain("multi_line_lambda")
	})

	// Test comprehensions
	it("should capture comprehensions", () => {
		expect(parseResult).toContain("multi_line_comprehension")
	})

	// Test with statements
	it("should capture with statements", () => {
		expect(parseResult).toContain("with")
	})

	// Test try statements
	it("should capture try statements", () => {
		expect(parseResult).toContain("try")
	})

	// Test import statements
	it("should capture import statements", () => {
		expect(parseResult).toContain("from typing import")
	})

	// Test global/nonlocal statements
	it("should capture global and nonlocal statements", () => {
		expect(parseResult).toContain("scope_demonstration")
	})

	// Test match case statements
	it("should capture match case statements", () => {
		expect(parseResult).toContain("multi_line_pattern_match")
	})

	// Test type annotations
	it("should capture type annotations", () => {
		expect(parseResult).toContain("multi_line_type_annotation")
	})
})
