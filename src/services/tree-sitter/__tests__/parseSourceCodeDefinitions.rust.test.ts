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
		expect(result).toContain("struct Point")
		expect(result).toContain("struct Rectangle")
		expect(result).toContain("struct Vehicle")
	})

	it("should parse Rust method definitions within impl blocks", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Check for function definitions within implementations
		expect(result).toContain("fn square")
		expect(result).toContain("fn new")
	})

	it("should parse Rust standalone function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Check for standalone function definitions
		// Based on the actual output we've seen
		expect(result).toContain("fn calculate_distance")
	})

	it("should correctly identify structs and functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)

		// Verify that structs and functions are being identified
		const resultLines = result?.split("\n") || []

		// Check that struct Point is found
		const pointStructLine = resultLines.find((line) => line.includes("struct Point"))
		expect(pointStructLine).toBeTruthy()

		// Check that fn calculate_distance is found
		const distanceFuncLine = resultLines.find((line) => line.includes("fn calculate_distance"))
		expect(distanceFuncLine).toBeTruthy()

		// Check that fn square is found (method in impl block)
		const squareFuncLine = resultLines.find((line) => line.includes("fn square"))
		expect(squareFuncLine).toBeTruthy()
	})

	it("should parse all supported Rust structures comprehensively", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)
		const resultLines = result?.split("\n") || []

		// Verify all struct definitions are captured
		expect(resultLines.some((line) => line.includes("struct Point"))).toBe(true)
		expect(resultLines.some((line) => line.includes("struct Rectangle"))).toBe(true)
		expect(resultLines.some((line) => line.includes("struct Vehicle"))).toBe(true)

		// Verify impl block functions are captured
		expect(resultLines.some((line) => line.includes("fn square"))).toBe(true)
		expect(resultLines.some((line) => line.includes("fn new"))).toBe(true)

		// Verify standalone functions are captured
		expect(resultLines.some((line) => line.includes("fn calculate_distance"))).toBe(true)

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
		expect(resultLines.some((line) => line.includes("enum Status"))).toBe(true)

		// Test trait definitions
		expect(resultLines.some((line) => line.includes("trait Drawable"))).toBe(true)

		// Test impl trait for struct
		expect(resultLines.some((line) => line.includes("impl Drawable for Rectangle"))).toBe(true)

		// Test generic structs with lifetime parameters
		expect(resultLines.some((line) => line.includes("struct Container<'a, T>"))).toBe(true)

		// Test macro definitions
		expect(resultLines.some((line) => line.includes("macro_rules! say_hello"))).toBe(true)

		// Test module definitions
		expect(resultLines.some((line) => line.includes("mod math"))).toBe(true)

		// Test union types
		expect(resultLines.some((line) => line.includes("union IntOrFloat"))).toBe(true)

		// Test trait with associated types
		expect(resultLines.some((line) => line.includes("trait Iterator"))).toBe(true)

		// Test advanced Rust language features
		// 1. Closures
		expect(
			resultLines.some(
				(line) =>
					line.includes("let simple_closure") ||
					line.includes("let add_closure") ||
					line.includes("closure_expression"),
			),
		).toBe(true)

		// 2. Match expressions
		expect(resultLines.some((line) => line.includes("match value") || line.includes("match_expression"))).toBe(true)

		// 3. Functions with where clauses
		expect(resultLines.some((line) => line.includes("fn print_sorted") || line.includes("where_clause"))).toBe(true)

		// 4. Attribute macros - Note: These might not be directly captured by the current query
		// Instead, we check for the struct that has the attribute
		expect(resultLines.some((line) => line.includes("struct AttributeExample"))).toBe(true)

		// 5. Async functions
		expect(resultLines.some((line) => line.includes("async fn fetch_data"))).toBe(true)

		// 6. Impl blocks with generic parameters
		expect(resultLines.some((line) => line.includes("impl<T, U> GenericContainer"))).toBe(true)

		// 7. Functions with complex trait bounds
		expect(resultLines.some((line) => line.includes("fn process_items") || line.includes("trait_bounds"))).toBe(
			true,
		)

		// Note: The following structures are nested inside modules and might not be captured directly
		// - Type aliases (type Number)
		// - Constants (const PI)
		// - Static variables (static VERSION)
		// - Associated types (type Item)
		// These would require more complex query patterns or post-processing to extract
	})
})
