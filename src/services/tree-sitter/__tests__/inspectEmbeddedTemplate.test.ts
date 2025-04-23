import { describe, it } from "@jest/globals"
import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { embeddedTemplateQuery } from "../queries"
import sampleEmbeddedTemplateContent from "./fixtures/sample-embedded_template"

describe("inspectEmbeddedTemplate", () => {
	const testOptions = {
		language: "embedded_template",
		wasmFile: "tree-sitter-embedded_template.wasm",
		queryString: embeddedTemplateQuery,
		extKey: "embedded_template",
	}

	it("should inspect embedded template tree structure", async () => {
		await inspectTreeStructure(sampleEmbeddedTemplateContent, "embedded_template")
	})

	it("should parse embedded template definitions", async () => {
		await testParseSourceCodeDefinitions("test.erb", sampleEmbeddedTemplateContent, testOptions)
	})
})
