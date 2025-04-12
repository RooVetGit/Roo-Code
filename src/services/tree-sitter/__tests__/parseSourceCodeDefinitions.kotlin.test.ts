import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { kotlinQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleKotlinContent from "./fixtures/sample-kotlin"

const kotlinOptions = {
	language: "kotlin",
	wasmFile: "tree-sitter-kotlin.wasm",
	queryString: kotlinQuery,
	extKey: "kt",
}
const testOptions = {
	language: "kotlin",
	wasmFile: "tree-sitter-kotlin.wasm",
	queryString: kotlinQuery,
	extKey: "kt",
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

describe("parseSourceCodeDefinitionsForFile with Kotlin", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should debug Kotlin tree structure", async () => {
		if (process.env.DEBUG) {
			await inspectTreeStructure(sampleKotlinContent, "kotlin")
		}
		expect(true).toBe(true) // Dummy assertion
	})

	it("should parse Kotlin class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for class declarations
		expect(result).toContain("class TestClassDefinition")
		expect(result).toContain("class TestClassWithConstructor")
		// TestUser is not captured by the parser
	})

	it("should parse Kotlin data class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for data class declarations
		expect(result).toContain("data class TestDataClass")
		// Nested data classes are not captured by the parser
	})

	it("should parse Kotlin interface declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for interface declarations
		expect(result).toContain("interface TestInterface")
	})

	it("should parse Kotlin enum class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for enum class declarations
		expect(result).toContain("enum class TestEnumClass")
	})

	it("should parse Kotlin abstract class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for abstract class declarations
		expect(result).toContain("abstract class TestAbstractClass")
	})

	it("should parse Kotlin sealed class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for sealed class declarations
		expect(result).toContain("sealed class TestSealedClass")
	})

	it("should parse Kotlin object declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for object declarations
		expect(result).toContain("object TestObject")
		// Nested objects are not captured by the parser
	})

	it("should parse Kotlin companion object declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for companion object declarations in TestCompanionObjectClass
		expect(result).toContain("companion object")
	})

	it("should parse Kotlin function declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for function declarations
		expect(result).toContain("fun testFunction")
	})

	it("should parse Kotlin generic class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for generic class declarations
		expect(result).toContain("class TestGenericClass")
	})

	it("should parse Kotlin annotation class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for annotation class declarations
		expect(result).toContain("annotation class TestAnnotationClass")
	})

	it("should parse Kotlin suspend functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for suspend functions
		expect(result).toContain("suspend fun testSuspendFunction")
	})
})
