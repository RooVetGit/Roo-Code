import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { swiftQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleSwiftContent from "./fixtures/sample-swift"

// Swift test options
const testOptions = {
	language: "swift",
	wasmFile: "tree-sitter-swift.wasm",
	queryString: swiftQuery,
	extKey: "swift",
}

// Mock fs module
jest.mock("fs/promises")
const mockedFs = fs as jest.Mocked<typeof fs>

// Mock languageParser module
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))

// Mock file existence check
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

describe("parseSourceCodeDefinitionsForFile with Swift", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Debug test to inspect the tree structure
	it("should debug Swift tree structure", async () => {
		// This test will only run when DEBUG=1 is set
		if (!process.env.DEBUG) {
			return
		}

		// Initialize tree-sitter
		const TreeSitter = await initializeTreeSitter()

		// Create parser and load Swift language
		const parser = new TreeSitter()
		const wasmPath = path.join(process.cwd(), "dist/tree-sitter-swift.wasm")
		const swiftLang = await TreeSitter.Language.load(wasmPath)
		parser.setLanguage(swiftLang)

		// Parse the content
		const tree = parser.parse(sampleSwiftContent)

		// Print the tree structure for debugging
		debugLog("SWIFT TREE STRUCTURE:\n" + tree.rootNode.toString())

		// Test passes if we can inspect the tree
		expect(tree).toBeDefined()
	})

	it("should capture class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for class declarations
		expect(result).toContain("class TestBaseClass")
		expect(result).toContain("class TestClassDefinition: TestBaseClass")
		expect(result).toContain("class TestPlatformClass")
	})

	it("should capture struct declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for struct declarations
		expect(result).toContain("struct TestStructDefinition<T: Comparable>")
		expect(result).toContain("struct TestPropertyWrapper<Value: Numeric & Comparable>")
	})

	it("should capture enum declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for enum declarations
		expect(result).toContain("enum TestEnumDefinition<T>")
		expect(result).toContain("enum TestError")
	})

	it("should capture protocol declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for protocol declarations
		expect(result).toContain("protocol TestProtocolOne")
		expect(result).toContain("protocol TestProtocolTwo")
		expect(result).toContain("protocol TestProtocolDefinition")
	})

	it("should capture extensions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for extensions
		expect(result).toContain("extension TestClassDefinition")
		expect(result).toContain("extension TestStructDefinition")
	})

	it("should capture standalone functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for standalone functions
		expect(result).toContain("func testThrowingFunction(_ testParam: String)")
	})

	it("should capture property wrappers", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for property wrappers
		expect(result).toContain("struct TestPropertyWrapper<Value: Numeric & Comparable>")
		expect(result).toContain("var wrappedValue: Value")
	})

	it("should capture error handling constructs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for error handling constructs
		expect(result).toContain("enum TestError")
		expect(result).toContain("func testThrowingFunction(_ testParam: String)")
	})

	it("should capture conditional compilation blocks", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for conditional compilation blocks
		expect(result).toContain("class TestPlatformClass")
	})
})
