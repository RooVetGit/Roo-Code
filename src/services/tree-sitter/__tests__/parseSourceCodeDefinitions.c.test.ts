import { describe, it } from "@jest/globals"
import { testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { cQuery } from "../queries"
import sampleCContent from "./fixtures/sample-c"

describe("parseSourceCodeDefinitionsForFile with C", () => {
	const testOptions = {
		language: "c",
		wasmFile: "tree-sitter-c.wasm",
		queryString: cQuery,
		extKey: "c",
	}

	// Single test to inspect tree structure
	it("should inspect C tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		if (!result || !result.match(/\d+--\d+ \|/)) {
			throw new Error("Failed to parse C tree structure")
		}
		debugLog("C Tree Structure Result:", result)
	})

	// Test all function-related constructs
	it("should capture function constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const functionPatterns = [
			/\d+--\d+ \| void multiline_prototype\(/,
			/\d+--\d+ \| void function_pointer_prototype\(/,
			/\d+--\d+ \| int variadic_prototype\(/,
			/\d+--\d+ \| int basic_multitype_function\(/,
			/\d+--\d+ \| void array_param_function\(/,
			/\d+--\d+ \| void pointer_param_function\(/,
			/\d+--\d+ \| int variadic_impl_function\(/,
		]

		for (const pattern of functionPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing function pattern: ${pattern}`)
			}
		}
		debugLog(
			"Function Constructs:",
			lines.filter((l) => l.includes("function")),
		)
	})

	// Test all struct-related constructs
	it("should capture struct constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const structPatterns = [
			/\d+--\d+ \| union basic_types_struct/,
			/\d+--\d+ \| struct nested_struct/,
			/\d+--\d+ \| struct bitfield_struct/,
			/\d+--\d+ \| struct callback_struct/,
			/\d+--\d+ \| struct aligned_struct/,
			/\d+--\d+ \| struct anonymous_union_struct/,
		]

		for (const pattern of structPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing struct pattern: ${pattern}`)
			}
		}
		debugLog(
			"Struct Constructs:",
			lines.filter((l) => l.includes("struct")),
		)
	})

	// Test all union constructs
	it("should capture union constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const unionPatterns = [/\d+--\d+ \| union multitype_data_union/, /\d+--\d+ \| union bitfield_union/]

		for (const pattern of unionPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing union pattern: ${pattern}`)
			}
		}
		debugLog(
			"Union Constructs:",
			lines.filter((l) => l.includes("union")),
		)
	})

	// Test all enum constructs
	it("should capture enum constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const enumPatterns = [
			/\d+--\d+ \| enum sequential_value_enum/,
			/\d+--\d+ \| enum explicit_value_enum/,
			/\d+--\d+ \| enum mixed_value_enum/,
		]

		for (const pattern of enumPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing enum pattern: ${pattern}`)
			}
		}
		debugLog(
			"Enum Constructs:",
			lines.filter((l) => l.includes("enum")),
		)
	})

	// Test all typedef constructs
	it("should capture typedef constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const typedefPatterns = [/\d+--\d+ \| typedef struct \{/]

		for (const pattern of typedefPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing typedef pattern: ${pattern}`)
			}
		}
		debugLog(
			"Typedef Constructs:",
			lines.filter((l) => l.includes("typedef")),
		)
	})

	// Test all preprocessor constructs
	it("should capture preprocessor constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const macroPatterns = [
			/\d+--\d+ \| #define TEST_MIN\(a,b\) \(/,
			/\d+--\d+ \| #define TEST_MAX\(a,b\) \(/,
			/\d+--\d+ \| \s+#define TEST_DEBUG_LOG\(level, msg, \.\.\.\) do \{/,
		]

		for (const pattern of macroPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing macro pattern: ${pattern}`)
			}
		}
		debugLog(
			"Preprocessor Constructs:",
			lines.filter((l) => l.includes("#define")),
		)
	})

	// Test all global variable constructs
	it("should capture global variable constructs", async () => {
		const result = await testParseSourceCodeDefinitions("test.c", sampleCContent, testOptions)
		const lines = result?.split("\n") || []
		const varPatterns = [
			/\d+--\d+ \| static const int MAGIC_NUMBER =/,
			/\d+--\d+ \| static const char\* const BUILD_INFO\[\]/,
			/\d+--\d+ \| static struct config_struct/,
		]

		for (const pattern of varPatterns) {
			if (!lines.some((line) => pattern.test(line))) {
				throw new Error(`Missing variable pattern: ${pattern}`)
			}
		}
		debugLog(
			"Global Variable Constructs:",
			lines.filter((l) => l.includes("static")),
		)
	})
})
