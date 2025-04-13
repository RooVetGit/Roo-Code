import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { csharpQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleCSharpContent from "./fixtures/sample-c-sharp"

// C# test options
const csharpOptions = {
	language: "c_sharp",
	wasmFile: "tree-sitter-c_sharp.wasm",
	queryString: csharpQuery,
	extKey: "cs",
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

describe("parseSourceCodeDefinitionsForFile with C#", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test for tree structure inspection
	it("should inspect C# tree structure", async () => {
		await inspectTreeStructure(sampleCSharpContent, "c_sharp")
	})

	// Test namespace declarations
	it("should capture namespace declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestNamespaceDefinition")
		expect(result).toContain("TestFileScopedNamespaceDefinition")
	})

	// Test class declarations with various modifiers
	it("should capture class declarations with modifiers", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestClassDefinition")
		expect(result).toContain("TestStaticClassDefinition")
		expect(result).toContain("TestAbstractClassDefinition")
		expect(result).toContain("TestPartialClassDefinition")
		expect(result).toContain("TestNestedClassDefinition")
		expect(result).toContain("TestGenericClassDefinition")
	})

	// Test interface declarations
	it("should capture interface declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("ITestInterfaceDefinition")
	})

	// Test struct declarations
	it("should capture struct declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestStructDefinition")
	})

	// Test enum declarations
	it("should capture enum declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestEnumDefinition")
	})

	// Test record declarations
	it("should capture record declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestRecordDefinition")
	})

	// Test method declarations with various modifiers
	it("should capture method declarations with modifiers", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestAsyncMethodDefinition")
		expect(result).toContain("TestExtensionMethod1")
		expect(result).toContain("TestExtensionMethod2")
		expect(result).toContain("TestGenericMethodDefinition")
	})

	// Test property declarations
	it("should capture property declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestPropertyDefinition")
		expect(result).toContain("TestPropertyWithAccessor")
		expect(result).toContain("TestPropertyWithInit")
		expect(result).toContain("TestRequiredProperty")
	})

	// Test event declarations
	it("should capture event declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestEventDefinition")
	})

	// Test delegate declarations
	it("should capture delegate declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestDelegateDefinition")
	})

	// Test attribute declarations
	it("should capture attribute declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		expect(result).toContain("TestAttributeDefinition")
	})
})
