import { describe, it, expect } from "@jest/globals"
import { testParseSourceCodeDefinitions } from "./helpers"
import { elispQuery } from "../queries/elisp"
import sampleElispContent from "./fixtures/sample-elisp"

describe("parseSourceCodeDefinitions.elisp", () => {
	const testOptions = {
		language: "elisp",
		wasmFile: "tree-sitter-elisp.wasm",
		queryString: elispQuery,
		extKey: "el",
	}

	it("should parse Elisp definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.el", sampleElispContent, testOptions)
		expect(result).toBeDefined()

		// Verify all definition types are captured
		// Test core definitions
		expect(result).toMatch(/\d+--\d+ \| \(defun test-function/)
		expect(result).toMatch(/\d+--\d+ \| \(defmacro test-macro/)
		expect(result).toMatch(/\d+--\d+ \| \(defcustom test-custom/)
		expect(result).toMatch(/\d+--\d+ \| \(defface test-face/)
		expect(result).toMatch(/\d+--\d+ \| \(defgroup test-group/)

		// Verify line numbers are included
		expect(result).toMatch(/\d+--\d+ \|/)

		// Verify the number of definitions
		const matches = result?.match(/\d+--\d+ \|/g) || []
		expect(matches.length).toBe(5) // Function, macro, custom, face, group
	})
})
