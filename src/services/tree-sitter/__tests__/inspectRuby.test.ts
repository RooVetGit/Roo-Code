import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { rubyQuery } from "../queries"
import sampleRubyContent from "./fixtures/sample-ruby"

describe("inspectRuby", () => {
	const testOptions = {
		language: "ruby",
		wasmFile: "tree-sitter-ruby.wasm",
		queryString: rubyQuery,
		extKey: "rb",
	}

	it("should inspect Ruby tree structure", async () => {
		await inspectTreeStructure(sampleRubyContent, "ruby")
	})

	it("should parse Ruby definitions", async () => {
		await testParseSourceCodeDefinitions("test.rb", sampleRubyContent, testOptions)
	})
})
