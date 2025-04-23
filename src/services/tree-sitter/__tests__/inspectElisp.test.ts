import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { elispQuery } from "../queries/elisp"
import sampleElispContent from "./fixtures/sample-elisp"

describe("inspectElisp", () => {
	const testOptions = {
		language: "elisp",
		wasmFile: "tree-sitter-elisp.wasm",
		queryString: elispQuery,
		extKey: "el",
	}

	it("should inspect Elisp tree structure", async () => {
		await inspectTreeStructure(sampleElispContent, "elisp")
	})

	it("should parse Elisp definitions", async () => {
		await testParseSourceCodeDefinitions("test.el", sampleElispContent, testOptions)
	})
})
