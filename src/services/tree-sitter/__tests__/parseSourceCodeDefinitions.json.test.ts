import * as fs from "fs/promises"
import * as path from "path"

import { describe, expect, it, jest, beforeEach } from "@jest/globals"

import { javascriptQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleJsonContent from "./fixtures/sample-json"

// JSON test options
const jsonOptions = {
	language: "javascript",
	wasmFile: "tree-sitter-javascript.wasm",
	queryString: javascriptQuery,
	extKey: "json",
	content: sampleJsonContent,
}

// Mock file system operations
jest.mock("fs/promises")
const mockedFs = jest.mocked(fs)

// Mock fileExistsAtPath to return true for our test paths
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

// Mock loadRequiredLanguageParsers
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))

describe("jsonParserDebug", () => {
	it("should debug tree-sitter parsing directly using JSON example", async () => {
		jest.unmock("fs/promises")

		// Initialize tree-sitter
		const TreeSitter = await initializeTreeSitter()

		// Create parser and query
		const parser = new TreeSitter()
		const wasmPath = path.join(process.cwd(), "dist/tree-sitter-javascript.wasm")
		const jsLang = await TreeSitter.Language.load(wasmPath)
		parser.setLanguage(jsLang)
		const tree = parser.parse(sampleJsonContent)

		expect(tree).toBeDefined()
	})

	it("should successfully parse basic JSON objects", async function () {
		const testFile = "/test/config.json"
		const result = await testParseSourceCodeDefinitions(testFile, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain("# config.json")
		expect(result).toContain('"test_object_with_primitives"')
		expect(result).toContain('"test_nested_objects"')
		expect(result).toContain('"test_arrays"')
	})

	it("should detect nested JSON objects and arrays", async function () {
		const testFile = "/test/nested.json"
		const result = await testParseSourceCodeDefinitions(testFile, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain('"test_object"')
		expect(result).toContain('"test_deep_object"')
		expect(result).toContain('"test_object_array"')
		expect(result).toContain('"test_mixed_array"')
	})
})

describe("parseSourceCodeDefinitions for JSON", () => {
	const testFilePath = "/test/config.json"

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock file existence check
		mockedFs.access.mockResolvedValue(undefined)

		// Mock file reading
		mockedFs.readFile.mockResolvedValue(Buffer.from(sampleJsonContent))
	})

	it("should parse top-level object properties", async function () {
		debugLog("\n=== Parse Test: Top-level Properties ===")
		const result = await testParseSourceCodeDefinitions(testFilePath, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain('"test_object_with_primitives"')
		expect(result).toContain('"test_nested_objects"')
		expect(result).toContain('"test_arrays"')
	})

	it("should parse nested object properties", async function () {
		debugLog("\n=== Parse Test: Nested Properties ===")
		const result = await testParseSourceCodeDefinitions(testFilePath, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain('"test_object"')
		expect(result).toContain('"test_nested_objects"')
		expect(result).toContain('"test_deep_object"')
	})

	it("should parse arrays in JSON", async function () {
		debugLog("\n=== Parse Test: Arrays ===")
		const result = await testParseSourceCodeDefinitions(testFilePath, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain('"test_arrays"')
		expect(result).toContain('"test_object_array"')
		expect(result).toContain('"test_mixed_array"')
	})

	it("should handle complex nested structures", async function () {
		debugLog("\n=== Parse Test: Complex Nested Structures ===")
		const result = await testParseSourceCodeDefinitions(testFilePath, sampleJsonContent, jsonOptions)
		expect(result).toBeDefined()
		expect(result).toContain('"test_deep_object"')
		expect(result).toContain('"level1"')
	})
})
