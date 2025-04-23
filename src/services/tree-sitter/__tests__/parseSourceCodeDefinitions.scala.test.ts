import { describe, expect, it, jest, beforeAll, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { scalaQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import { sampleScala as sampleScalaContent } from "./fixtures/sample-scala"

// Scala test options
const scalaOptions = {
	language: "scala",
	wasmFile: "tree-sitter-scala.wasm",
	queryString: scalaQuery,
	extKey: "scala",
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

describe("parseSourceCodeDefinitionsForFile with Scala", () => {
	beforeAll(async () => {
		await initializeTreeSitter()
	})

	it("should inspect Scala tree structure", async () => {
		await inspectTreeStructure(sampleScalaContent, "scala")
	})

	it("should parse Scala package declarations", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("com.example")
	})

	it("should parse Scala class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("TestCaseClass")
		expect(result).toContain("PatternMatcher")
		expect(result).toContain("AbstractBase")
		expect(result).toContain("ForComprehension")
	})

	it("should parse Scala trait definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("TestTrait")
	})

	it("should parse Scala object definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("Types")
		expect(result).toContain("Variables")
	})

	it("should parse Scala method definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("processItems")
	})

	it("should parse Scala value definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("heavyComputation")
	})

	it("should parse Scala type definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScalaContent, scalaOptions)
		expect(result).toContain("T")
	})
})
