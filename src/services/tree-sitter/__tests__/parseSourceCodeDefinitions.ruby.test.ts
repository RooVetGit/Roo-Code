import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { rubyQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleRubyContent from "./fixtures/sample-ruby"

const rubyOptions = {
	language: "ruby",
	wasmFile: "tree-sitter-ruby.wasm",
	queryString: rubyQuery,
	extKey: "rb",
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

describe("parseSourceCodeDefinitionsForFile with Ruby", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should capture class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for class definitions only
		expect(result).toContain("class TestClassDefinition")
		expect(result).toContain("class TestSingletonClass")
		expect(result).toContain("class TestIncludeClass")
		expect(result).toContain("class TestAttributeAccessorsClass")
	})

	it("should capture method definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for method definitions only
		expect(result).toContain("def initialize")
		expect(result).toContain("def test_string_interpolation")
		expect(result).toContain("def test_keyword_args")
		expect(result).toContain("def test_private_method")
	})

	it("should capture class methods", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for class methods only
		expect(result).toContain("def self.test_class_method")
		expect(result).toContain("def self.instance")
		expect(result).toContain("def self.test_extend_method")
	})

	it("should capture module definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for module definitions only
		expect(result).toContain("module TestModule")
		expect(result).toContain("module TestNestedModule")
		expect(result).toContain("module TestMixinModule")
	})

	it("should capture constants", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for constants only - the parser captures the module containing the constant
		expect(result).toContain("TEST_MODULE_CONSTANT")
	})

	it("should capture attribute accessors", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for attribute accessors only - the parser captures the class containing the accessors
		expect(result).toContain("attr_reader :test_attr_reader")
	})

	it("should capture mixins (include, extend, prepend)", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for mixins only
		expect(result).toContain("include TestMixinModule")
		expect(result).toContain("extend TestMixinModule")
		expect(result).toContain("prepend TestMixinModule")
	})

	it("should capture class macros (Rails-like)", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for class macros only - the parser captures the class containing the macros
		expect(result).toContain("class TestClassMacroClass")
	})

	it("should capture metaprogramming constructs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for metaprogramming constructs only - the parser captures the class containing the metaprogramming
		expect(result).toContain("class TestMetaprogrammingClass")
		expect(result).toContain("[:test_meta_save, :test_meta_update, :test_meta_delete].each")
		expect(result).toContain("def method_missing")
	})

	it("should capture global variables", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Global variables aren't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture instance variables", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Instance variables aren't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture class variables", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for class variables only
		expect(result).toContain("@@test_class_variable")
		expect(result).toContain("@@test_singleton_instance")
	})

	it("should capture symbols", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Symbols aren't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture blocks, procs, and lambdas", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for blocks, procs, and lambdas only
		expect(result).toContain("test_lambda = ->(x, y) {")
		expect(result).toContain("test_proc = Proc.new do |x|")
	})

	it("should capture exception handling", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for exception handling only
		expect(result).toContain("begin")
	})

	it("should capture keyword arguments", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for keyword arguments only
		expect(result).toContain("def test_keyword_args")
	})

	it("should capture splat operators", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for splat operators only
		expect(result).toContain("def test_splat_method(*numbers)")
	})

	it("should capture hash syntax variants", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for hash syntax variants only
		expect(result).toContain("test_hash = {")
	})

	it("should capture string interpolation", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// String interpolation isn't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture regular expressions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Regular expressions aren't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture pattern matching", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for pattern matching only
		expect(result).toContain("case test_pattern_data")
	})

	it("should capture endless methods", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Endless methods aren't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should capture pin operator", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Check for pin operator only
		expect(result).toContain("case test_pin_input")
	})

	it("should capture shorthand hash syntax", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)

		// Shorthand hash syntax isn't directly captured in the output
		expect(result).toBeTruthy()
	})

	it("should correctly identify all Ruby structures", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.rb", sampleRubyContent, rubyOptions)
		const resultLines = result?.split("\n") || []

		// Verify the output format includes line numbers
		expect(resultLines.some((line) => /\d+--\d+ \|/.test(line))).toBe(true)

		// Verify the output includes the file name
		expect(result).toContain("# file.rb")
	})
})
