import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { embeddedTemplateQuery } from "../queries"
import sampleEmbeddedTemplateContent from "./fixtures/sample-embedded_template"

describe("parseSourceCodeDefinitions (Embedded Template)", () => {
	const testOptions = {
		language: "embedded_template",
		wasmFile: "tree-sitter-embedded_template.wasm",
		queryString: embeddedTemplateQuery,
		extKey: "erb", // Use the actual file extension since parseSourceCodeDefinitionsForFile uses the file extension
		minComponentLines: 1, // Allow single-line expressions
	}

	it("should inspect embedded template tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.erb", sampleEmbeddedTemplateContent, testOptions)
		debugLog("All definitions:", result)

		// Verify result is a string containing expected definitions
		expect(typeof result).toBe("string")
		expect(result).toContain("# test.erb")

		// Code blocks
		expect(result).toMatch(/\d+--\d+ \| <% def complex_helper/)
		expect(result).toMatch(/\d+--\d+ \| <% class TemplateHelper/)
		expect(result).toMatch(/\d+--\d+ \| <% module TemplateUtils/)
	})
})
