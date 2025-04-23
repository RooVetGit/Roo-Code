import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { tomlQuery } from "../queries"
import { sampleToml } from "./fixtures/sample-toml"

describe("parseSourceCodeDefinitions (TOML)", () => {
	const testOptions = {
		language: "toml",
		wasmFile: "tree-sitter-toml.wasm",
		queryString: tomlQuery,
		extKey: "toml",
	}

	it("should inspect TOML tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.toml", sampleToml, testOptions)
		debugLog("All definitions:", result)

		// Verify result is a string containing expected definitions
		expect(typeof result).toBe("string")
		expect(result).toContain("# test.toml")

		// Table declarations
		expect(result).toMatch(/\d+--\d+ \| \[database\]/)
		expect(result).toMatch(/\d+--\d+ \| \[servers\]/)
		expect(result).toMatch(/\d+--\d+ \| \[owner\.personal\]/)

		// Array of tables
		expect(result).toMatch(/\d+--\d+ \| \[\[products\]\]/)

		// Complex tables and structures
		expect(result).toMatch(/\d+--\d+ \| \[complex_values\]/)
		expect(result).toMatch(/\d+--\d+ \| \[mixed_content\]/)

		// Arrays and multi-line strings
		expect(result).toMatch(/\d+--\d+ \| strings = \[/)
		expect(result).toMatch(/\d+--\d+ \| dates = \[/)
		expect(result).toMatch(/\d+--\d+ \| description = """/)
		expect(result).toMatch(/\d+--\d+ \| features = \[/)
	})
})
