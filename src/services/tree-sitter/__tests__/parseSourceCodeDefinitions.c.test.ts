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
	it("should capture function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for specific function definition
		expect(resultLines.some((line) => line.includes("test_function_definition"))).toBe(true)
	})

	it("should capture functions with parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with parameters
		expect(resultLines.some((line) => line.includes("test_function_with_params"))).toBe(true)
	})

	it("should capture functions with pointer parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with pointer parameters
		expect(resultLines.some((line) => line.includes("test_function_with_pointers"))).toBe(true)
	})

	it("should capture functions with array parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with array parameters
		expect(resultLines.some((line) => line.includes("test_function_with_array"))).toBe(true)
	})

	it("should capture variadic functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for variadic function
		expect(resultLines.some((line) => line.includes("test_variadic_function"))).toBe(true)
	})

	// Note: Inline functions are not currently supported by the parser

	// Struct definitions
	it("should capture struct definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for specific struct definition
		expect(result).toContain("struct test_struct_definition")
	})

	it("should capture nested struct definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for nested struct
		expect(result).toContain("struct test_nested_struct")
	})

	it("should capture structs with bit fields", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for struct with bit fields
		expect(result).toContain("struct test_struct_with_bitfields")
	})

	it("should capture structs with function pointer members", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for struct with function pointer member
		expect(result).toContain("struct test_struct_with_function_ptr")
	})

	// Note: Union definitions are not fully supported by the parser

	// Enum definitions
	it("should capture enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for enum definition
		expect(result).toContain("enum test_enum_definition")
	})

	// Typedef declarations
	it("should capture typedef struct declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for typedef struct
		expect(result).toContain("typedef struct")
	})

	// Note: The parser only supports typedef struct declarations, not primitive or function pointer typedefs

	// Note: Simple macro definitions are not supported by the parser, only complex ones

	// Note: The following constructs are not currently supported by the parser:
	// - Global variables
	// - Static variables and functions
	// - Extern declarations
	// - Function pointers
	// - Array declarations
	// - Pointer declarations

	// C11 features
	it("should capture C11 anonymous union structs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for C11 anonymous union struct
		expect(result).toContain("struct test_anonymous_union")
	})

	it("should capture C11 alignas structs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for C11 alignas struct
		expect(result).toContain("struct test_alignas_struct")
	})

	// Note: C11 atomic types are not currently supported by the parser
})
