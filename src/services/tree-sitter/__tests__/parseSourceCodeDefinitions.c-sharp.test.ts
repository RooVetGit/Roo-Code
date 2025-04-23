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
	let parseResult: string

	beforeAll(async () => {
		// Cache parse result for all tests
		const result = await testParseSourceCodeDefinitions("/test/file.cs", sampleCSharpContent, csharpOptions)
		if (!result) {
			throw new Error("Failed to parse C# source code definitions")
		}
		parseResult = result
		debugLog("C# Parse Result:", parseResult)
		// Inspect tree structure once at start
		await inspectTreeStructure(sampleCSharpContent, "c_sharp")
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test using directives - 4+ lines
	it("should capture using directives", () => {
		expect(parseResult).toContain("2--390 | // Using directives test - at least 4 lines long")
		expect(parseResult).toContain("ITestInterfaceDefinition")
		expect(parseResult).toContain("TestClassDefinition")
	})

	// Test namespace declarations - 4+ lines
	it("should capture namespace declarations", () => {
		expect(parseResult).toContain("namespace TestNamespaceDefinition")
		expect(parseResult).toContain("namespace TestFileScopedNamespaceDefinition")
		expect(parseResult).toContain("public class TestFileScopedClassDefinition")
		expect(parseResult).toContain("public void TestFileScopedMethod")
	})

	// Test class declarations with inheritance - 4+ lines
	it("should capture class declarations with inheritance", () => {
		expect(parseResult).toContain("public class TestClassDefinition : ITestInterfaceDefinition")
		expect(parseResult).toContain("public class TestDerivedClass1 : TestAbstractClassDefinition")
		expect(parseResult).toContain("public class TestDerivedClass2 : TestAbstractClassDefinition")
		expect(parseResult).toContain("public class TestEventArgsDefinition : EventArgs")
	})

	// Test class declarations with attributes - 4+ lines
	it("should capture class declarations with attributes", () => {
		expect(parseResult).toContain("9--22 | [AttributeUsage")
		expect(parseResult).toContain("TestAttributeDefinition")
		expect(parseResult).toContain("Attribute")
	})

	// Test generic class declarations - 4+ lines
	it("should capture generic class declarations", () => {
		expect(parseResult).toContain("TestGenericClassDefinition")
		expect(parseResult).toContain("TestGenericClassMethod1")
		expect(parseResult).toContain("TestGenericClassMethod2")
		expect(parseResult).toContain("TestGenericMethodWithConstraint")
	})

	// Test nested class declarations - 4+ lines
	it("should capture nested class declarations", () => {
		expect(parseResult).toContain("TestOuterClassDefinition")
		expect(parseResult).toContain("TestNestedClassDefinition")
		expect(parseResult).toContain("TestNestedMethod")
	})

	// Test interface declarations - 4+ lines
	it("should capture interface declarations", () => {
		expect(parseResult).toContain("28--34 |     public interface ITestInterfaceDefinition")
		expect(parseResult).toContain("136--140 |         public int TestInterfaceCalculateMethod(int x, int y)")
	})

	// Test enum declarations - 4+ lines
	it("should capture enum declarations", () => {
		expect(parseResult).toContain("37--44 |     public enum TestEnumDefinition")
		expect(parseResult).toContain("60--64 |         public TestEnumDefinition TestPropertyWithAccessor")
	})

	// Test method declarations - 4+ lines
	it("should capture method declarations", () => {
		expect(parseResult).toContain("136--140 |         public int TestInterfaceCalculateMethod(int x, int y)")
		expect(parseResult).toContain("182--185 |         public override string ToString()")
	})

	// Test static method declarations - 4+ lines
	it("should capture static method declarations", () => {
		expect(parseResult).toContain("TestStaticClassDefinition")
		expect(parseResult).toContain("TestExtensionMethod1")
		expect(parseResult).toContain("TestExtensionMethod2")
	})

	// Test generic method declarations - 4+ lines
	it("should capture generic method declarations", () => {
		expect(parseResult).toContain("TestGenericMethodDefinition")
		expect(parseResult).toContain("TestGenericMethodWithConstraint")
		expect(parseResult).toContain("TestGenericClassMethod2")
		expect(parseResult).toContain("TestGenericClassMethod1")
	})

	// Test async method declarations - 4+ lines
	it("should capture async method declarations", () => {
		expect(parseResult).toContain("TestAsyncMethodDefinition")
		expect(parseResult).toContain("TestAsyncPrivateMethod1")
		expect(parseResult).toContain("TestAsyncPrivateMethod2")
	})

	// Test property declarations - 4+ lines
	it("should capture property declarations", () => {
		expect(parseResult).toContain("public string TestPropertyDefinition")
		expect(parseResult).toContain("public TestEnumDefinition TestPropertyWithAccessor")
		expect(parseResult).toContain("public string TestPropertyWithInit")
		expect(parseResult).toContain("public required string TestRequiredProperty")
	})

	// Test field declarations - 4+ lines
	it("should capture field declarations", () => {
		expect(parseResult).toContain("TestPropertyDefinition")
		expect(parseResult).toContain("TestPropertyWithAccessor")
		expect(parseResult).toContain("TestPropertyWithInit")
	})

	// Test event declarations - 4+ lines
	it("should capture event declarations", () => {
		expect(parseResult).toContain("TestEventDefinition")
		expect(parseResult).toContain("EventHandler")
		expect(parseResult).toContain("TestEventArgsDefinition")
	})

	// Test delegate declarations - 4+ lines
	it("should capture delegate declarations", () => {
		expect(parseResult).toContain("TestDelegateDefinition")
		expect(parseResult).toContain("delegate")
	})

	// Test struct declarations - 4+ lines
	it("should capture struct declarations", () => {
		expect(parseResult).toContain("TestStructDefinition")
		expect(parseResult).toContain("struct")
	})

	// Test record declarations - 4+ lines
	it("should capture record declarations", () => {
		expect(parseResult).toContain("TestRecordDefinition")
		expect(parseResult).toContain("record")
		expect(parseResult).toContain("TestRecordMethodDefinition")
	})

	// Test LINQ expressions - 4+ lines
	it("should capture LINQ expressions", () => {
		expect(parseResult).toContain("TestLinqMethod")
		expect(parseResult).toContain("from num in _numbers")
		expect(parseResult).toContain("IEnumerable")
	})

	// Test LINQ expressions
	it("should capture LINQ expressions", () => {
		expect(parseResult).toContain("TestLinqExpressionDefinition")
		expect(parseResult).toContain("TestLinqMethod")
	})
})
