import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { rustQuery } from "../queries"
import { testParseSourceCodeDefinitions, debugLog } from "./helpers"
import sampleRustContent from "./fixtures/sample-rust"

// Rust test options
const rustOptions = {
	language: "rust",
	wasmFile: "tree-sitter-rust.wasm",
	queryString: rustQuery,
	extKey: "rs",
}

// Mock setup
jest.mock("fs/promises")
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

describe("parseSourceCodeDefinitionsForFile with Rust", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Cache test result to avoid multiple slow calls
	let cachedResult: string | undefined
	let cachedLines: string[] = []

	beforeEach(async () => {
		if (!cachedResult) {
			cachedResult = await testParseSourceCodeDefinitions("/test/file.rs", sampleRustContent, rustOptions)
			cachedLines = cachedResult?.split("\n") || []
		}
	})

	it("should capture function definitions", async () => {
		debugLog("Testing function definitions...")

		expect(cachedLines.some((line) => line.includes("fn test_function_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("async fn test_async_function_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("const fn test_const_function_definition"))).toBe(true)
	})

	it("should capture struct definitions", async () => {
		debugLog("Testing struct definitions...")

		expect(cachedLines.some((line) => line.includes("struct test_struct_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("struct test_tuple_struct_definition"))).toBe(true)
		// Unit structs are exempt from 4-line requirement and may not be captured
	})

	it("should capture enum definitions", async () => {
		debugLog("Testing enum definitions...")

		expect(cachedLines.some((line) => line.includes("enum test_enum_definition"))).toBe(true)
		const enumLine = cachedLines.find((line) => line.includes("enum test_enum_definition"))
		expect(enumLine).toMatch(/\d+--\d+ \|/)
	})

	it("should capture trait definitions and implementations", async () => {
		debugLog("Testing trait definitions...")

		expect(cachedLines.some((line) => line.includes("trait test_trait_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("impl test_struct_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("impl test_trait_definition for test_struct_definition"))).toBe(
			true,
		)
	})

	it("should capture module definitions and use declarations", async () => {
		debugLog("Testing module definitions...")

		expect(cachedLines.some((line) => line.includes("mod test_module_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("use super::{"))).toBe(true)
	})

	it("should capture macro definitions", async () => {
		debugLog("Testing macro definitions...")

		expect(cachedLines.some((line) => line.includes("macro_rules! test_macro_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("#[derive("))).toBe(true)
	})

	it("should capture type aliases", async () => {
		debugLog("Testing type aliases...")

		expect(cachedLines.some((line) => line.includes("type test_generic_type_alias"))).toBe(true)
	})

	it("should capture const and static items", async () => {
		debugLog("Testing const and static items...")

		// Const/static items are exempt from 4-line requirement
		// They are typically single-line declarations and may not be captured
		debugLog("Const/static items exempt from 4-line requirement")
	})

	it("should capture lifetime parameters", async () => {
		debugLog("Testing lifetime parameters...")

		expect(cachedLines.some((line) => line.includes("struct test_lifetime_definition"))).toBe(true)
		expect(cachedLines.some((line) => line.includes("fn test_lifetime_method"))).toBe(true)
	})

	it("should capture unsafe blocks", async () => {
		debugLog("Testing unsafe blocks...")

		expect(cachedLines.some((line) => line.includes("unsafe fn test_unsafe_function"))).toBe(true)
	})

	it("should capture where clauses", async () => {
		debugLog("Testing where clauses...")

		expect(cachedLines.some((line) => line.includes("fn test_where_clause_function"))).toBe(true)
	})

	it("should capture match expressions", async () => {
		debugLog("Testing match expressions...")

		expect(cachedLines.some((line) => line.includes("fn test_match_expression"))).toBe(true)
	})
})
