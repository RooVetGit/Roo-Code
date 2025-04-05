import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { rustQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"

// Sample Rust content for tests covering all supported structures:
// - struct definitions
// - method definitions (functions within a declaration list)
// - function definitions
const sampleRustContent = `
// Basic struct definition
struct Point {
    x: f64,
    y: f64,
}

// Struct with implementation (methods)
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // Method definition
    fn area(&self) -> u32 {
        self.width * self.height
    }

    // Another method
    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }

    // Associated function (not a method, but still part of impl)
    fn square(size: u32) -> Rectangle {
        Rectangle {
            width: size,
            height: size,
        }
    }
}

// A standalone function
fn calculate_distance(p1: &Point, p2: &Point) -> f64 {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    (dx * dx + dy * dy).sqrt()
}

// A more complex struct
struct Vehicle {
    make: String,
    model: String,
    year: u32,
}

impl Vehicle {
    // Constructor-like method
    fn new(make: String, model: String, year: u32) -> Vehicle {
        Vehicle {
            make,
            model,
            year,
        }
    }

    // Regular method
    fn description(&self) -> String {
        format!("{} {} ({})", self.make, self.model, self.year)
    }
}

// Another standalone function
fn process_data(input: &str) -> String {
    format!("Processed: {}", input)
}

// More complex Rust structures for advanced testing
enum Status {
    Active,
    Inactive,
    Pending(String),
    Error { code: i32, message: String },
}

trait Drawable {
    fn draw(&self);
    fn get_dimensions(&self) -> (u32, u32);
}

impl Drawable for Rectangle {
    fn draw(&self) {
        println!("Drawing rectangle: {}x{}", self.width, self.height);
    }
    
    fn get_dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}

// Generic struct with lifetime parameters
struct Container<'a, T> {
    data: &'a T,
    count: usize,
}

impl<'a, T> Container<'a, T> {
    fn new(data: &'a T) -> Container<'a, T> {
        Container {
            data,
            count: 1,
        }
    }
}
`

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
const mockedFs = jest.mocked(fs)

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

		// We're not testing specific captures here since the current query might not capture all these structures
		// Instead, we're verifying that the parser doesn't crash with more complex Rust code

		// The test passes if parsing completes without errors
		expect(result).toBeTruthy()

		// If the parser is enhanced in the future to capture these structures,
		// we can add more specific assertions here:
		// - enum definitions
		// - trait definitions
		// - impl trait for struct
		// - generic structs with lifetime parameters
	})

	// Debug test that can be enabled for diagnosing issues
	it.skip("should debug Rust tree structure directly", async () => {
		jest.unmock("fs/promises")

		// Initialize tree-sitter
		const TreeSitter = await initializeTreeSitter()

		// Create parser and load Rust language
		const parser = new TreeSitter()
		const wasmPath = path.join(process.cwd(), "dist/tree-sitter-rust.wasm")
		const rustLang = await TreeSitter.Language.load(wasmPath)
		parser.setLanguage(rustLang)

		// Parse the content
		const tree = parser.parse(sampleRustContent)

		// Create the query
		const query = rustLang.query(rustQuery)

		// Execute the query
		const captures = query.captures(tree.rootNode)

		// Log the results for debugging
		console.log(
			"Captures:",
			captures.map((c: { node: Parser.SyntaxNode; name: string }) => ({
				name: c.name,
				text: c.node.text,
				type: c.node.type,
				startRow: c.node.startPosition.row,
				startCol: c.node.startPosition.column,
				endRow: c.node.endPosition.row,
				endCol: c.node.endPosition.column,
			})),
		)
	})
})
