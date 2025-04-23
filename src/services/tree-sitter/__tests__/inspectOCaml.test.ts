import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { ocamlQuery } from "../queries"
import { sampleOCaml } from "./fixtures/sample-ocaml"

describe("inspectOCaml", () => {
	const testOptions = {
		language: "ocaml",
		wasmFile: "tree-sitter-ocaml.wasm",
		queryString: ocamlQuery,
		extKey: "ml",
	}

	it("should inspect OCaml tree structure", async () => {
		await inspectTreeStructure(sampleOCaml, "ocaml")
	})

	it("should parse OCaml definitions", async () => {
		await testParseSourceCodeDefinitions("test.ml", sampleOCaml, testOptions)
	})
})
