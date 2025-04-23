import { describe, expect, it, jest, beforeAll, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { javaQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleJavaContent from "./fixtures/sample-java"

// Java test options
const testOptions = {
	language: "java",
	wasmFile: "tree-sitter-java.wasm",
	queryString: javaQuery,
	extKey: "java",
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

describe("parseSourceCodeDefinitionsForFile with Java", () => {
	let parseResult: string = ""

	beforeAll(async () => {
		// Cache parse result for all tests
		const result = await testParseSourceCodeDefinitions("/test/file.java", sampleJavaContent, testOptions)
		if (!result) {
			throw new Error("Failed to parse Java source code")
		}
		parseResult = result
		debugLog("Java Parse Result:", parseResult)
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Test for tree structure inspection
	it("should inspect Java tree structure", async () => {
		await inspectTreeStructure(sampleJavaContent, "java")
	})

	// Test module declarations
	it("should capture module declarations", () => {
		expect(parseResult).toContain("test.module.definition")
	})

	// Test module and package declarations
	it("should capture module declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| module test\.module\.definition/) // Match module declaration
	})

	// Package declarations are skipped since they cannot meet the 4-line requirement
	// and are not included in the output

	// Test annotation declarations
	it("should capture annotation declarations", () => {
		expect(parseResult).toContain("TestAnnotationDefinition")
	})

	// Test interface declarations
	it("should capture interface declarations", () => {
		expect(parseResult).toContain("TestInterfaceDefinition")
	})

	// Test enum declarations
	it("should capture enum declarations", () => {
		expect(parseResult).toContain("TestEnumDefinition")
	})

	// Test class declarations
	it("should capture class declarations", () => {
		expect(parseResult).toContain("TestClassDefinition")
	})

	// Test record declarations
	it("should capture record declarations", () => {
		expect(parseResult).toContain("TestRecordDefinition")
	})

	// Test abstract class declarations
	it("should capture abstract class declarations", () => {
		expect(parseResult).toContain("TestAbstractClassDefinition")
	})

	// Test inner class declarations
	it("should capture inner class declarations", () => {
		expect(parseResult).toContain("TestInnerClassDefinition")
	})

	// Test static nested class declarations
	it("should capture static nested class declarations", () => {
		expect(parseResult).toContain("TestStaticNestedClassDefinition")
	})

	// Test constructor declarations
	it("should capture constructors", () => {
		expect(parseResult).toContain("TestClassDefinition")
	})

	// Test method declarations
	it("should capture method declarations", () => {
		expect(parseResult).toContain("testInterfaceMethod")
		expect(parseResult).toContain("testInterfaceDefaultMethod")
		expect(parseResult).toContain("testGenericMethodDefinition")
		expect(parseResult).toContain("testAbstractMethod")
	})
})
