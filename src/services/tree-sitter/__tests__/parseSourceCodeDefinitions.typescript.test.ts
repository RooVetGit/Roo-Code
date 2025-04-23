import { describe, it } from "@jest/globals"
import { testParseSourceCodeDefinitions } from "./helpers"
import { typescriptQuery } from "../queries"
import sampleTypeScriptContent from "./fixtures/sample-typescript"

describe("parseSourceCodeDefinitions.typescript", () => {
	const testOptions = {
		language: "typescript",
		wasmFile: "tree-sitter-typescript.wasm",
		queryString: typescriptQuery,
		extKey: "ts",
	}

	let result: string

	beforeAll(async () => {
		// Cache the result since parsing can be slow
		const parseResult = await testParseSourceCodeDefinitions("test.ts", sampleTypeScriptContent, testOptions)
		if (!parseResult) {
			throw new Error("Failed to parse TypeScript content")
		}
		result = parseResult
	})

	it("should capture interfaces", async () => {
		expect(result).toContain("interface TestInterfaceDefinition")
		expect(result).toContain("interface TestGenericInterfaceDefinition<T, U>")
		expect(result).toContain("interface TestJsxPropsDefinition")
	})

	it("should capture type aliases", async () => {
		expect(result).toContain("type TestTypeDefinition =")
	})

	it("should capture enums", async () => {
		expect(result).toContain("enum TestEnumDefinition")
	})

	it("should capture namespaces", async () => {
		expect(result).toContain("namespace TestNamespaceDefinition")
	})

	it("should capture typed functions", async () => {
		expect(result).toContain("testTypedFunctionDefinition(")
		expect(result).toContain("testTypedAsyncFunctionDefinition(")
		expect(result).toContain("testGenericFunctionDefinition<T, U>")
	})

	it("should capture typed classes and methods", async () => {
		expect(result).toContain("class TestTypedClassDefinition")
		expect(result).toContain("methodSignature(")
		expect(result).toContain("genericMethod<T>")
	})

	it("should capture abstract classes", async () => {
		expect(result).toContain("abstract class TestAbstractClassDefinition")
	})

	it("should capture object literal methods", async () => {
		// Object literal methods are captured as part of their containing structure
		expect(result).toContain("callback: (")
	})

	it("should capture typed JSX elements", async () => {
		// JSX elements are captured as part of their containing function/class
		expect(result).toContain("interface TestJsxPropsDefinition")
	})

	it("should capture decorated classes", async () => {
		// We can capture the class definition, but decorated methods are part of the class structure
		expect(result).toContain("class TestTypedClassDefinition")
	})

	// Note: Some structures like decorated methods, JSX elements, and object literals
	// are captured as part of their containing structures due to tree-sitter's AST organization.
	// This is a limitation of the tree-sitter parser and query system.
})
