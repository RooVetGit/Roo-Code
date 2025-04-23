import { describe, expect, it, jest, beforeAll, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { luaQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import sampleLuaContent from "./fixtures/sample-lua"

// Lua test options
const luaOptions = {
	language: "lua",
	wasmFile: "tree-sitter-lua.wasm",
	queryString: luaQuery,
	extKey: "lua",
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

describe("parseSourceCodeDefinitionsForFile with Lua", () => {
	beforeAll(async () => {
		await initializeTreeSitter()
	})

	it("should inspect Lua tree structure", async () => {
		await inspectTreeStructure(sampleLuaContent, "lua")
	})

	it("should parse Lua function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.lua", sampleLuaContent, luaOptions)
		expect(result).toContain("test_function")
		expect(result).toContain("test_local_function")
	})

	it("should parse Lua table definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.lua", sampleLuaContent, luaOptions)
		expect(result).toContain("test_table_with_methods")
		expect(result).toContain("test_table")
		expect(result).toContain("test_array_table")
	})

	it("should parse Lua variable declarations", async () => {
		const result = await testParseSourceCodeDefinitions("test.lua", sampleLuaContent, luaOptions)
		expect(result).toContain("test_variable_declaration")
		expect(result).toContain("test_local_variable")
	})

	it("should parse Lua module definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.lua", sampleLuaContent, luaOptions)
		expect(result).toContain("test_module")
		expect(result).toContain("test_module_function")
	})
})
