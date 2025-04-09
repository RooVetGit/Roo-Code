import { readFile } from "fs/promises"
import { parseCodeFileByQueries } from "../parser"

// Mock fs/promises
jest.mock("fs/promises")
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>

describe("parseCodeFileByQueries", () => {
	beforeEach(() => {
		mockedReadFile.mockClear()
	})

	it("should return blocks based on query matches within size limits", async () => {
		const mockTsContent = `
	// Line 1
	function smallFunction() { // Line 2
	  console.log('small'); // Line 3
	} // Line 4

	// Line 6
	class MyClass { // Line 7
	  constructor() { // Line 8
	    console.log('init'); // Line 9
	  } // Line 10

	  // Line 12
	  mediumMethod() { // Line 13
	    const x = 1; // Line 14
	    const y = 2; // Line 15
	    const z = 3; // Line 16
	    return x + y + z; // Line 17
	  } // Line 18

	  // Line 20
	  /**
	   * A large method that should exceed the default max line count.
	   */
	  anotherMethod() { // Line 24
	    // Line 25
	    // ... many lines ...
	    // Line 123
	    console.log('end large method'); // Line 124
	  } // Line 125
	} // Line 126
	`

		mockedReadFile.mockResolvedValue(mockTsContent)

		const filePath = "dummy/path/file.ts"
		const result = await parseCodeFileByQueries(filePath)

		expect(result).toBeInstanceOf(Array)

		// Expecting smallFunction, MyClass, mediumMethod, constructor, anotherMethod
		expect(result.some((b) => b.identifier === "smallFunction")).toBeTruthy()
		expect(result.some((b) => b.identifier === "MyClass")).toBeTruthy()
		expect(result.some((b) => b.identifier === "mediumMethod")).toBeTruthy()
		expect(result.some((b) => b.identifier === "constructor")).toBeTruthy()
		expect(result.some((b) => b.identifier === "anotherMethod")).toBeTruthy()

		// Verify nested blocks are included
		const smallFunctionBlock = result.find((b) => b.identifier === "smallFunction")
		expect(smallFunctionBlock?.type).toBe("function_declaration")

		const classBlock = result.find((b) => b.identifier === "MyClass")
		expect(classBlock?.type).toBe("class_declaration")

		const mediumMethodBlock = result.find((b) => b.identifier === "mediumMethod")
		expect(mediumMethodBlock?.type).toBe("method_definition")

		const constructorBlock = result.find((b) => b.identifier === "constructor")
		expect(constructorBlock?.type).toBe("method_definition")

		const anotherMethodBlock = result.find((b) => b.identifier === "anotherMethod")
		expect(anotherMethodBlock?.type).toBe("method_definition")

		expect(mockedReadFile).toHaveBeenCalledTimes(1)
		expect(mockedReadFile).toHaveBeenCalledWith(filePath, "utf-8")
	})

	it("should fallback to recursive splitting when a query match exceeds MAX_BLOCK_LINES", async () => {
		const largeClassContent = `
class HugeClass {
${Array.from({ length: 150 }, (_, i) => `  method${i}() { console.log(${i}) }`).join("\n")}
}
`
		mockedReadFile.mockResolvedValue(largeClassContent)

		const filePath = "dummy/path/hugeFile.ts"
		const result = await parseCodeFileByQueries(filePath)

		expect(result).toBeInstanceOf(Array)

		// The large class should be split into smaller blocks
		const hugeClassBlock = result.find((b) => b.identifier === "HugeClass")
		expect(hugeClassBlock).toBeUndefined()

		// Instead, many smaller method blocks should be present
		const methodBlocks = result.filter((b) => b.identifier?.startsWith("method"))
		expect(methodBlocks.length).toBeGreaterThan(1)
	})
})
