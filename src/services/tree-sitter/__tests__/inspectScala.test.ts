import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { scalaQuery } from "../queries"
import { sampleScala } from "./fixtures/sample-scala"

describe("inspectScala", () => {
	const testOptions = {
		language: "scala",
		wasmFile: "tree-sitter-scala.wasm",
		queryString: scalaQuery,
		extKey: "scala",
	}

	it("should inspect Scala tree structure", async () => {
		await inspectTreeStructure(sampleScala, "scala")
	})

	it("should parse Scala definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.scala", sampleScala, testOptions)
		debugLog("Scala parse result:", result)
	})
})
