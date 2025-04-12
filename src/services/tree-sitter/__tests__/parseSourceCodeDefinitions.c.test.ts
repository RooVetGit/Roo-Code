import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { cQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleCContent from "./fixtures/sample-c"
const cOptions = {
	language: "c",
	wasmFile: "tree-sitter-c.wasm",
	queryString: cQuery,
	extKey: "c",
	content: sampleCContent,
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

describe("parseSourceCodeDefinitionsForFile with C", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Debug test to inspect the tree structure
	it("should debug C tree structure", async () => {
		// Initialize tree-sitter
		const TreeSitter = await initializeTreeSitter()

		// Create parser and load C language
		const parser = new TreeSitter()
		const wasmPath = path.join(process.cwd(), "dist/tree-sitter-c.wasm")
		const cLang = await TreeSitter.Language.load(wasmPath)
		parser.setLanguage(cLang)

		// Parse a simple C code snippet
		const simpleCode = `
struct Point {
    int x;
    int y;
};

int add(int a, int b) {
    return a + b;
}
`
		// Parse the content
		const tree = parser.parse(simpleCode)

		// Print the tree structure for debugging
		debugLog("C TREE STRUCTURE:\n" + tree.rootNode.toString())

		// Test passes if we can inspect the tree
		expect(tree).toBeDefined()
	})

	// Function definitions
	it("should capture basic function definition", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		expect(resultLines.some((line) => line.includes("test_basic_function"))).toBe(true)
	})

	it("should capture function with array parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		expect(resultLines.some((line) => line.includes("test_array_function"))).toBe(true)
	})

	it("should capture function with pointer parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		expect(resultLines.some((line) => line.includes("test_pointer_function"))).toBe(true)
	})

	it("should capture variadic function", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		expect(resultLines.some((line) => line.includes("test_variadic_function"))).toBe(true)
	})

	// Struct definitions
	it("should capture basic struct definition", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestBasicStruct")
	})

	it("should capture nested struct definition", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestNestedStruct")
	})

	it("should capture struct with bit fields", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestBitFieldStruct")
	})

	it("should capture struct with function pointer", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestCallbackStruct")
	})

	// Enum definitions
	it("should capture basic enum definition", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("enum TestBasicEnum")
	})

	it("should capture enum with explicit values", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("enum TestValuedEnum")
	})

	// Typedef declarations
	it("should capture typedef struct", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("typedef struct")
	})

	// C11 features
	it("should capture anonymous union struct", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestAnonymousUnion")
	})

	it("should capture aligned struct", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		expect(result).toContain("struct TestAlignedStruct")
	})

	// Note: C11 atomic types are not currently supported by the parser
})
