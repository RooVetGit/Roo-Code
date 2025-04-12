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

	it("should parse Kotlin basic class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("class TestBasicClass")
	})

	it("should parse Kotlin data class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("data class TestDataClass")
	})

	it("should parse Kotlin generic function declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("fun <T : Any> testGenericFunction")
	})

	it("should parse Kotlin companion object declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("companion object TestCompanion")
	})

	it("should parse Kotlin interface declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("interface TestInterface")
	})

	it("should parse Kotlin abstract class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("abstract class TestAbstractClass")
	})

	it("should parse Kotlin enum class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("enum class TestEnumClass")
	})

	it("should parse Kotlin sealed class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("sealed class TestSealedClass")
	})

	it("should parse Kotlin object (singleton) declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("object TestSingleton")
	})

	it("should parse Kotlin annotation class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("annotation class TestAnnotation")
	})

	it("should parse Kotlin generic class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("class TestGenericClass")
	})

	it("should parse Kotlin suspend functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)
		expect(result).toContain("suspend fun testSuspendFunction")
	})
})
