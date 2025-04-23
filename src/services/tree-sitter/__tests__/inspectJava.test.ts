import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { javaQuery } from "../queries"
import sampleJavaContent from "./fixtures/sample-java"

describe("inspectJava", () => {
	const testOptions = {
		language: "java",
		wasmFile: "tree-sitter-java.wasm",
		queryString: javaQuery,
		extKey: "java",
	}

	it("should inspect Java tree structure", async () => {
		await inspectTreeStructure(sampleJavaContent, "java")
	})

	it("should parse Java definitions", async () => {
		await testParseSourceCodeDefinitions("test.java", sampleJavaContent, testOptions)
	})
})
