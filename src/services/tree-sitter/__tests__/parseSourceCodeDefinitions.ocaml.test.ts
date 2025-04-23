import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { ocamlQuery } from "../queries"
import { sampleOCaml } from "./fixtures/sample-ocaml"

describe("parseSourceCodeDefinitions (OCaml)", () => {
	const testOptions = {
		language: "ocaml",
		wasmFile: "tree-sitter-ocaml.wasm",
		queryString: ocamlQuery,
		extKey: "ml",
	}

	let parseResult = "" as string

	beforeAll(async () => {
		const result = await testParseSourceCodeDefinitions("test.ml", sampleOCaml, testOptions)
		if (result) {
			parseResult = result
		}
		debugLog("All definitions:", parseResult)
	})

	it("should capture module with signature", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| module StringSet : sig/)
	})

	it("should capture functor definition", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| module OrderedMap \(Key: sig/)
	})

	it("should capture variant type definition", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| type shape =/)
	})

	it("should capture record type definition", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| type person = {/)
	})

	it("should capture pattern matching function", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| let rec process_list = function/)
	})

	it("should capture multi-argument function", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| let calculate_area ~width ~height/)
	})

	it("should capture class definition", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| class virtual \['a\] container = object/)
	})

	it("should capture object expression", async () => {
		expect(parseResult).toMatch(/\d+--\d+ \| let make_counter initial = object/)
	})
})
