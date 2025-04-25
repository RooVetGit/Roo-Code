import { describe, it, expect, beforeAll } from "@jest/globals"
import sampleGoContent from "./fixtures/sample-go"
import { testParseSourceCodeDefinitions } from "./helpers"
import goQuery from "../queries/go"

describe("Go Source Code Definition Tests", () => {
	let parseResult: string

	beforeAll(async () => {
		const testOptions = {
			language: "go",
			wasmFile: "tree-sitter-go.wasm",
			queryString: goQuery,
			extKey: "go",
		}

		const result = await testParseSourceCodeDefinitions("file.go", sampleGoContent, testOptions)
		expect(result).toBeDefined()
		parseResult = result as string
	})

	it("should parse package declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*package main/)
	})

	it("should parse import declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*"fmt"/)
		expect(parseResult).toMatch(/\d+--\d+ \|\s*"sync"/)
		expect(parseResult).toMatch(/\d+--\d+ \|\s*"time"/)
	})

	it("should parse const declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*TestConstDefinition1 = "test1"/)
		expect(parseResult).toMatch(/\d+--\d+ \|\s*TestConstDefinition2 = "test2"/)
	})

	it("should parse var declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*TestVarDefinition1 string = "var1"/)
		expect(parseResult).toMatch(/\d+--\d+ \|\s*TestVarDefinition2 int\s*= 42/)
	})

	it("should parse interface declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*type TestInterfaceDefinition interface/)
	})

	it("should parse struct declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*type TestStructDefinition struct/)
	})

	it("should parse type declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*type TestTypeDefinition struct/)
	})

	it("should parse function declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func TestFunctionDefinition\(/)
	})

	it("should parse method declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func \(t \*TestStructDefinition\) TestMethodDefinition\(/)
	})

	it("should parse channel function declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func TestChannelDefinition\(/)
	})

	it("should parse goroutine function declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func TestGoroutineDefinition\(\)/)
	})

	it("should parse defer function declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func TestDeferDefinition\(\)/)
	})

	it("should parse select function declarations", () => {
		expect(parseResult).toMatch(/\d+--\d+ \|\s*func TestSelectDefinition\(/)
	})
})
