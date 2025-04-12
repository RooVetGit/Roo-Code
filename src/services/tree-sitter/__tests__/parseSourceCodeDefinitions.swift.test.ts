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

		// Check for class declarations only
		expect(result).toContain("class TestClassDefinition")
		expect(result).toContain("class TestPropertyWrapperUser")
		expect(result).toContain("class TestiOSClass")
		expect(result).toContain("class TestMacOSClass")
		expect(result).toContain("class TestGenericClass")
	})
	it("should capture struct declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for struct declarations only
		expect(result).toContain("struct TestStructDefinition")
		expect(result).toContain("struct TestNestedStruct")
		expect(result).toContain("struct TestGenericStruct<T>")
		expect(result).toContain("struct TestPropertyWrapper<Value: Comparable>")
	})
	it("should capture enum declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for enum declarations only
		expect(result).toContain("enum TestEnumDefinition")
		expect(result).toContain("enum TestGenericEnum<Success, Failure>")
		expect(result).toContain("enum TestErrorEnum")
	})
	it("should capture protocol declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for protocol declarations only
		expect(result).toContain("protocol TestProtocolDefinition")
		expect(result).toContain("protocol TestGenericProtocol")
	})
	it("should capture extensions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for extensions only
		expect(result).toContain("extension TestStructDefinition: TestProtocolDefinition")
		expect(result).toContain("extension String")
	})
	it("should capture standalone functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for standalone functions only - only inout function is captured by the current grammar
		expect(result).toContain("func testInoutFunction<T>(_ a: inout T, _ b: inout T)")
		expect(result).toContain("func testErrorFunction(param: String)")
		// Note: Regular standalone functions are not captured by the current grammar
	})
	// Type aliases are not captured by the current grammar
	it("should capture property wrappers", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for property wrappers only
		expect(result).toContain("struct TestPropertyWrapper<Value: Comparable>")
		expect(result).toContain("var wrappedValue: Value")
	})
	it("should capture error handling constructs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for error handling constructs only
		expect(result).toContain("enum TestErrorEnum")
		expect(result).toContain("func testErrorFunction(param: String)")
	})
	it("should capture conditional compilation blocks", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)

		// Check for conditional compilation blocks only
		expect(result).toContain("class TestiOSClass")
		expect(result).toContain("class TestMacOSClass")
		expect(result).toContain("class TestGenericClass")
	})
})
