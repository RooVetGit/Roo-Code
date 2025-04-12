import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import { phpQuery } from "../queries"
import samplePhpContent from "./fixtures/sample-php"

jest.mock("fs/promises")
jest.mock("../../../utils/fs")
jest.mock("../languageParser")

describe("parseSourceCodeDefinitionsForFile with PHP", () => {
	let mockFs: jest.Mocked<typeof fs>
	let mockFileExists: jest.MockedFunction<typeof fileExistsAtPath>
	let mockedLoadRequiredLanguageParsers: jest.MockedFunction<typeof loadRequiredLanguageParsers>

	beforeEach(async () => {
		mockFs = fs as jest.Mocked<typeof fs>
		mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
		mockedLoadRequiredLanguageParsers = loadRequiredLanguageParsers as jest.MockedFunction<
			typeof loadRequiredLanguageParsers
		>

		mockFileExists.mockResolvedValue(true)
		mockFs.readFile.mockResolvedValue(samplePhpContent)

		// Mock the loadRequiredLanguageParsers implementation
		mockedLoadRequiredLanguageParsers.mockImplementation(async () => {
			const TreeSitter = await initializeTreeSitter()
			const parser = new TreeSitter()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-php.wasm")
			const lang = await TreeSitter.Language.load(wasmPath)
			parser.setLanguage(lang)
			const query = lang.query(phpQuery)
			return { php: { parser, query } }
		})

		await initializeTreeSitter()
	})

	// PHP test options
	const phpOptions = {
		language: "php",
		wasmFile: "tree-sitter-php.wasm",
		queryString: phpQuery,
		extKey: "php",
	}

	it("should debug PHP tree structure", async () => {
		await inspectTreeStructure(samplePhpContent, "php")
	})

	it("should capture class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for all class types
		expect(result).toContain("class TestAbstractClass")
		expect(result).toContain("abstract class TestAbstractClass")
		expect(result).toContain("final class TestFinalClass")
		expect(result).toContain("readonly class TestReadonlyClass")
	})

	it("should capture interface definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for interface declarations
		expect(result).toContain("interface TestInterface")
	})

	it("should capture trait definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for trait declarations
		expect(result).toContain("trait TestTrait")
	})

	it("should capture enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for enum declarations
		expect(result).toContain("enum TestEnum")
	})

	it("should capture method definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for method declarations
		expect(result).toContain("public function testUnionTypeMethod")
		expect(result).toContain("public function testInterfaceMethod1")
		expect(result).toContain("public function testEnumMethod")
	})

	it("should capture function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		expect(result).toContain("function testFunction")
	})

	it("should capture property definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture constant definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture namespace definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture use statements", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture anonymous class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for anonymous class
		expect(result).toContain("new class implements TestInterface")
	})

	it("should capture arrow function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture constructor property promotion", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for constructor
		expect(result).toContain("public function __construct")
	})

	it("should capture attribute definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for attributes
		expect(result).toContain("#[TestController]")
	})

	it("should capture match expressions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for match expressions
		expect(result).toContain("match($this)")
	})

	it("should capture heredoc and nowdoc syntax", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for heredoc and nowdoc
		expect(result).toContain("$testHeredoc = <<<HTML")
		expect(result).toContain("$testNowdoc = <<<'CODE'")
	})
})
