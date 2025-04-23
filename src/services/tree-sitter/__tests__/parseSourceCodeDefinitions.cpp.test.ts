import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { cppQuery } from "../queries"
import sampleCppContent from "./fixtures/sample-cpp"

describe("parseSourceCodeDefinitions (C++)", () => {
	const testOptions = {
		language: "cpp",
		wasmFile: "tree-sitter-cpp.wasm",
		queryString: cppQuery,
		extKey: "cpp",
	}

	it("should inspect C++ tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.cpp", sampleCppContent, testOptions)
		debugLog("All definitions:", result)

		// Verify result is a string containing expected definitions
		expect(typeof result).toBe("string")
		expect(result).toContain("# test.cpp")

		// Function declarations
		expect(result).toMatch(/\d+--\d+ \| void function_with_implementation\(/)
		expect(result).toMatch(/\d+--\d+ \| void multiline_function_prototype\(/)

		// Struct declarations
		expect(result).toMatch(/\d+--\d+ \| struct four_field_struct/)

		// Class declarations
		expect(result).toMatch(/\d+--\d+ \| class base_class_definition/)
		expect(result).toMatch(/\d+--\d+ \| class constructor_test/)

		// Union declarations
		expect(result).toMatch(/\d+--\d+ \| union four_member_union/)

		// Enum declarations
		expect(result).toMatch(/\d+--\d+ \| enum class scoped_enumeration/)

		// Typedef declarations
		expect(result).toMatch(/\d+--\d+ \| typedef std::vector/)

		// Namespace declarations
		expect(result).toMatch(/\d+--\d+ \| namespace deeply_nested_namespace/)
		expect(result).toMatch(/\d+--\d+ \| \s+namespace inner/)
		expect(result).toMatch(/\d+--\d+ \| \{/)

		// Template declarations
		expect(result).toMatch(/\d+--\d+ \| template</)
		expect(result).toMatch(/\d+--\d+ \| class template_class_definition/)
		expect(result).toMatch(/\d+--\d+ \| \{/)

		// Macro definitions
		expect(result).toMatch(/\d+--\d+ \| #define MULTI_LINE_MACRO\(x, y\)/)

		// Variable declarations
		expect(result).toMatch(/\d+--\d+ \| static const std::map</)
		expect(result).toMatch(/\d+--\d+ \| \{/)

		// Constructor declarations
		expect(result).toMatch(/\d+--\d+ \| \s+constructor_test\(/)
		expect(result).toMatch(/\d+--\d+ \| \{/)

		// Destructor declarations
		expect(result).toMatch(/\d+--\d+ \| \s+~destructor_test/)

		// Operator overloads
		expect(result).toMatch(/\d+--\d+ \| \s+bool operator==/)
		expect(result).toMatch(/\d+--\d+ \| \s+bool operator</)
		expect(result).toMatch(/\d+--\d+ \| \{/)

		// Friend declarations
		expect(result).toMatch(/\d+--\d+ \| class friendship_class/)

		// Using declarations
		expect(result).toMatch(/\d+--\d+ \| class using_declaration_test :/)
	})
})
