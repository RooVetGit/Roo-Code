import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { tlaPlusQuery } from "../queries"
import sampleTLAPlusContent from "./fixtures/sample-tlaplus"

describe("parseSourceCodeDefinitions (TLA+)", () => {
	const testOptions = {
		language: "tlaplus",
		wasmFile: "tree-sitter-tlaplus.wasm",
		queryString: tlaPlusQuery,
		extKey: "tla",
	}

	it("should inspect TLA+ tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.tla", sampleTLAPlusContent, testOptions)
		debugLog("All definitions:", result)

		// Verify result is a string containing expected definitions
		expect(typeof result).toBe("string")
		expect(result).toContain("# test.tla")

		// Module declaration
		expect(result).toMatch(/\d+--\d+ \| ---- MODULE SimpleModule ----/)

		// Only test for definitions that are actually being captured
		expect(result).toMatch(/\d+--\d+ \| ---- MODULE SimpleModule ----/)
		expect(result).toMatch(/\d+--\d+ \| ComplexOperator\(seq\) ==/)
		expect(result).toMatch(/\d+--\d+ \| ProcessStep ==/)
		expect(result).toMatch(/\d+--\d+ \| HandleCase\(val\) ==/)
		expect(result).toMatch(/\d+--\d+ \| Factorial\[n \\in Nat\] ==/)
	})
})
