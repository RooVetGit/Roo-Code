import { describe, test } from "@jest/globals"
import sampleGoContent from "./fixtures/sample-go"
import { testParseSourceCodeDefinitions } from "./helpers"

describe("Go Code Definitions", () => {
	// Cache result to avoid repeated parsing
	let result: string | undefined

	// Get result once for all tests
	beforeAll(async () => {
		result = await testParseSourceCodeDefinitions("test.go", sampleGoContent, {
			language: "go",
			wasmFile: "tree-sitter-go.wasm",
			queryString: require("../queries/go").default,
			extKey: "go",
		})
	})

	test("should parse Go structures", async () => {
		expect(result).toBeDefined()
		expect(typeof result).toBe("string")

		// Verify each structure type is captured
		expect(result).toContain("type TestInterfaceDefinition interface") // Interface
		expect(result).toContain("type TestStructDefinition struct") // Struct
		expect(result).toContain("type TestTypeDefinition struct") // Type
		expect(result).toContain("func TestFunctionDefinition") // Function
		expect(result).toContain("func (t *TestStructDefinition) TestMethodDefinition") // Method
		expect(result).toContain("func TestChannelDefinition") // Channel
		expect(result).toContain("func TestGoroutineDefinition") // Goroutine
		expect(result).toContain("func TestDeferDefinition") // Defer
		expect(result).toContain("func TestSelectDefinition") // Select
	})
})
