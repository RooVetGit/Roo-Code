import { describe, it } from "@jest/globals"
import { testParseSourceCodeDefinitions } from "./helpers"
import { javascriptQuery } from "../queries"
import sampleJavaScriptContent from "./fixtures/sample-javascript"

describe("parseSourceCodeDefinitions.javascript", () => {
	const testOptions = {
		language: "javascript",
		wasmFile: "tree-sitter-javascript.wasm",
		queryString: javascriptQuery,
		extKey: "js",
	}

	let result: string

	beforeAll(async () => {
		// Cache the result since parsing can be slow
		const parseResult = await testParseSourceCodeDefinitions("test.js", sampleJavaScriptContent, testOptions)
		if (!parseResult) {
			throw new Error("Failed to parse JavaScript content")
		}
		result = parseResult
	})

	it("should capture function declarations", async () => {
		expect(result).toContain("testFunctionDefinition(")
		expect(result).toContain("testAsyncFunctionDefinition(")
		expect(result).toContain("testGeneratorFunctionDefinition(")
	})

	it("should capture arrow functions", async () => {
		expect(result).toContain("testArrowFunctionDefinition =")
	})

	it("should capture class declarations and methods", async () => {
		expect(result).toContain("class TestClassDefinition")
		expect(result).toContain("testMethodDefinition(")
		expect(result).toContain("testStaticMethodDefinition(")
		expect(result).toContain("testGetterDefinition")
		expect(result).toContain("testSetterDefinition")
	})

	it("should capture object literals and methods", async () => {
		expect(result).toContain("testObjectLiteralDefinition =")
		expect(result).toContain("methodInObject(")
		expect(result).toContain("computedProperty")
	})

	it("should capture JSX elements", async () => {
		expect(result).toContain("testJsxElementDefinition =")
	})

	it("should capture decorated classes", async () => {
		// We can capture the decorator and class
		expect(result).toContain("@testDecoratorDefinition")
		expect(result).toContain("class TestDecoratedClassDefinition")
	})

	// Note: Decorated methods are captured as part of their containing class
	// due to tree-sitter's AST structure for decorators
})
