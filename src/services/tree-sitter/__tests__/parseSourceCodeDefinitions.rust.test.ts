import { describe, expect, it, jest, beforeEach } from "@jest/globals"

import { rustQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleRustContent from "./fixtures/sample-rust"

// Rust test options
const rustOptions = {
	language: "rust",
	wasmFile: "tree-sitter-rust.wasm",
	queryString: rustQuery,
	extKey: "rs",
	content: sampleRustContent,
}

// Mock file system operations
jest.mock("fs/promises")

// Mock loadRequiredLanguageParsers
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))

// Mock fileExistsAtPath to return true for our test paths
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

describe("parseSourceCodeDefinitionsForFile with Rust", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should parse Rust struct definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Check for struct definitions
		expect(result).toContain("struct TestBasicStruct")
		expect(result).toContain("struct TestMethodStruct")
		expect(result).toContain("struct TestComplexStruct")
	})

	it("should parse Rust method definitions within impl blocks", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Check for function definitions within implementations
		expect(result).toContain("fn test_factory_method")
		expect(result).toContain("fn test_new_method")
	})

	it("should parse Rust standalone function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Check for standalone function definitions
		expect(result).toContain("fn test_calculation_function")
	})

	it("should correctly identify structs and functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Verify that structs and functions are being identified
		const resultLines = result?.split("\n") || []

		// Check that test struct is found
		const basicStructLine = resultLines.find((line) => line.includes("struct TestBasicStruct"))
		expect(basicStructLine).toBeTruthy()

		// Check that test calculation function is found
		const calcFuncLine = resultLines.find((line) => line.includes("fn test_calculation_function"))
		expect(calcFuncLine).toBeTruthy()

		// Check that test factory method is found (method in impl block)
		const factoryMethodLine = resultLines.find((line) => line.includes("fn test_factory_method"))
		expect(factoryMethodLine).toBeTruthy()
	})

	it("should parse all supported Rust structures comprehensively", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)
		const resultLines = result?.split("\n") || []

		// Verify all struct definitions are captured
		expect(resultLines.some((line) => line.includes("struct TestBasicStruct"))).toBe(true)
		expect(resultLines.some((line) => line.includes("struct TestMethodStruct"))).toBe(true)
		expect(resultLines.some((line) => line.includes("struct TestComplexStruct"))).toBe(true)

		// Verify impl block functions are captured
		expect(resultLines.some((line) => line.includes("fn test_factory_method"))).toBe(true)
		expect(resultLines.some((line) => line.includes("fn test_new_method"))).toBe(true)

		// Verify standalone functions are captured
		expect(resultLines.some((line) => line.includes("fn test_calculation_function"))).toBe(true)

		// Verify the output format includes line numbers
		expect(resultLines.some((line) => /\d+--\d+ \|/.test(line))).toBe(true)

		// Verify the output includes the file name
		expect(result).toContain("# file.rs")
	})

	it("should handle complex Rust structures", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)
		const resultLines = result?.split("\n") || []

		// Now we test specific captures for all supported structures
		expect(result).toBeTruthy()

		// Test enum definitions
		expect(resultLines.some((line) => line.includes("enum TestEnum"))).toBe(true)

		// Test trait definitions
		expect(resultLines.some((line) => line.includes("trait TestTrait"))).toBe(true)

		// Test impl trait for struct
		expect(resultLines.some((line) => line.includes("impl TestTrait for TestMethodStruct"))).toBe(true)

		// Test generic structs with lifetime parameters
		expect(resultLines.some((line) => line.includes("struct TestGenericStruct<'a, T>"))).toBe(true)

		// Test macro definitions
		expect(resultLines.some((line) => line.includes("macro_rules! test_macro"))).toBe(true)

		// Test module definitions
		expect(resultLines.some((line) => line.includes("mod test_module"))).toBe(true)

		// Test union types
		expect(resultLines.some((line) => line.includes("union TestUnion"))).toBe(true)

		// Test trait with associated types
		expect(resultLines.some((line) => line.includes("trait TestIterator"))).toBe(true)

		// Test advanced Rust language features
		// 1. Closures
		expect(
			resultLines.some((line) => line.includes("test_basic_closure") || line.includes("test_param_closure")),
		).toBe(true)

		// 2. Match expressions
		expect(resultLines.some((line) => line.includes("test_pattern_matching"))).toBe(true)

		// 3. Functions with where clauses
		expect(resultLines.some((line) => line.includes("test_where_clause"))).toBe(true)

		// 4. Attribute macros
		expect(resultLines.some((line) => line.includes("struct TestAttributeStruct"))).toBe(true)

		// 5. Async functions
		expect(resultLines.some((line) => line.includes("async fn test_async_function"))).toBe(true)

		// 6. Impl blocks with generic parameters
		expect(resultLines.some((line) => line.includes("impl<T, U> TestGenericImpl"))).toBe(true)

		// 7. Functions with complex trait bounds
		expect(resultLines.some((line) => line.includes("fn test_process_items"))).toBe(true)

		// Note: The following structures are nested inside modules and might not be captured directly
		// - Type aliases (type TestType)
		// - Constants (const TEST_CONSTANT)
		// - Static variables (static TEST_STATIC)
		// - Associated types (type TestItem)
		// These would require more complex query patterns or post-processing to extract
	})
})
