import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { swiftQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, debugLog } from "./helpers"
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
	// Cache the result to avoid repeated slow parsing
	let parsedResult: string | undefined

	// Run once before all tests to parse the Swift code
	beforeAll(async () => {
		// Parse Swift code once and store the result
		parsedResult = await testParseSourceCodeDefinitions("/test/file.swift", sampleSwiftContent, testOptions)
		debugLog("Swift code parsed once and cached for all tests")
	})

	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Single test for class declarations (standard, final, open, and inheriting classes)
	it("should capture class declarations with all modifiers", async () => {
		debugLog("Testing class declarations")
		// Check for standard class
		expect(parsedResult).toContain("class StandardClassDefinition")
		// Check for final class
		expect(parsedResult).toContain("final class FinalClassDefinition")
		// Check for open class
		expect(parsedResult).toContain("open class OpenClassDefinition")
		// Check for class with inheritance and protocol conformance
		expect(parsedResult).toContain("class InheritingClassDefinition: StandardClassDefinition, ProtocolDefinition")
	})

	// Single test for struct declarations (standard and generic structs)
	it("should capture struct declarations", async () => {
		debugLog("Testing struct declarations")
		// Check for standard struct
		expect(parsedResult).toContain("struct StandardStructDefinition")
		// Check for generic struct with constraints
		expect(parsedResult).toContain("struct GenericStructDefinition<T: Comparable, U>")
	})

	// Single test for protocol declarations (basic and with associated types)
	it("should capture protocol declarations", async () => {
		debugLog("Testing protocol declarations")
		// Check for basic protocol with requirements
		expect(parsedResult).toContain("protocol ProtocolDefinition")
		// Check for protocol with associated type
		expect(parsedResult).toContain("protocol AssociatedTypeProtocolDefinition")
	})

	// Single test for extension declarations (for class, struct, and protocol)
	it("should capture extension declarations", async () => {
		debugLog("Testing extension declarations")
		// Check for class extension
		expect(parsedResult).toContain("extension StandardClassDefinition")
		// Check for struct extension
		expect(parsedResult).toContain("extension StandardStructDefinition")
		// Check for protocol extension
		expect(parsedResult).toContain("extension ProtocolDefinition")
	})

	// Single test for method declarations (instance and type methods)
	it("should capture method declarations", async () => {
		debugLog("Testing method declarations")
		// Check for instance method
		expect(parsedResult).toContain("func instanceMethodDefinition")
		// Check for type/static method
		expect(parsedResult).toContain("static func typeMethodDefinition")
	})

	// Single test for property declarations (stored and computed)
	it("should capture property declarations", async () => {
		debugLog("Testing property declarations")
		// Check for stored property with observers
		expect(parsedResult).toContain("var storedPropertyWithObserver: Int = 0")
		// Check for computed property
		expect(parsedResult).toContain("var computedProperty: String")
	})

	// Single test for initializer declarations (designated and convenience)
	it("should capture initializer declarations", async () => {
		debugLog("Testing initializer declarations")
		// Check for designated initializer
		expect(parsedResult).toContain("init(")
		// Check for convenience initializer
		expect(parsedResult).toContain("convenience init(")
	})

	// Single test for deinitializer declarations
	it("should capture deinitializer declarations", async () => {
		debugLog("Testing deinitializer declarations")
		expect(parsedResult).toContain("deinit")
	})

	// Single test for subscript declarations
	it("should capture subscript declarations", async () => {
		debugLog("Testing subscript declarations")
		expect(parsedResult).toContain("subscript(")
	})

	// Single test for type alias declarations
	it("should capture type alias declarations", async () => {
		debugLog("Testing type alias declarations")
		// The tree-sitter grammar currently only captures the complex type alias
		// with generic constraints but not the simple one
		expect(parsedResult).toContain("typealias DictionaryOfArrays<")
		expect(parsedResult).toContain("class TypeAliasContainer")
	})
})
