import { describe, expect, it, beforeAll } from "@jest/globals"
import { testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { samplePythonContent } from "./fixtures/sample-python"
import { pythonQuery } from "../queries"

// Python test options
const pythonOptions = {
	language: "python",
	wasmFile: "tree-sitter-python.wasm",
	queryString: pythonQuery,
	extKey: "py",
}

describe("parseSourceCodeDefinitionsForFile with Python", () => {
	let parseResult: string | undefined

	beforeAll(async () => {
		// Cache parse result for all tests
		parseResult = await testParseSourceCodeDefinitions("test.py", samplePythonContent, pythonOptions)
		debugLog("Python Parse Result:", parseResult)
	})

	it("should parse class and method definitions", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| class MultiLineDecoratedClass:/)
		expect(parseResult).toMatch(/\d+--\d+ \| class MethodContainer:/)
		expect(parseResult).toMatch(/\d+--\d+ \|     def multi_line_method\(/)
		debugLog("Class and method definitions found:", parseResult)
	})

	it("should parse decorated and async function definitions", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| @class_decorator_one/)
		expect(parseResult).toMatch(/\d+--\d+ \| @function_decorator_one/)
		expect(parseResult).toMatch(/\d+--\d+ \| async def multi_line_async_function\(/)
		debugLog("Decorated and async functions found:", parseResult)
	})

	it("should parse special functions and expressions", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| def multi_line_generator\(/)
		expect(parseResult).toMatch(/\d+--\d+ \| multi_line_lambda = \(/)
		expect(parseResult).toMatch(/\d+--\d+ \| multi_line_comprehension = \[/)
		debugLog("Special functions and expressions found:", parseResult)
	})

	it("should parse control flow structures", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| with \(/)
		expect(parseResult).toMatch(/\d+--\d+ \| try:/)
		expect(parseResult).toMatch(/\d+--\d+ \| def scope_demonstration\(\):/)
		debugLog("Control flow structures found:", parseResult)
	})

	it("should parse module-level structures", () => {
		expect(parseResult).toMatch(/\d+--\d+ \| from typing import \(/)
		expect(parseResult).toMatch(/\d+--\d+ \| def multi_line_pattern_match\(/)
		expect(parseResult).toMatch(/\d+--\d+ \| multi_line_type_annotation: dict\[/)
		debugLog("Module-level structures found:", parseResult)
	})
})
