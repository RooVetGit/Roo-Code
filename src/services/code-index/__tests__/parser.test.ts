import { readFile } from "fs/promises"
import { parseCodeFileBySize } from "../parser" // Assuming index.ts is in the parent directory

// Mock fs/promises
jest.mock("fs/promises")
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>

describe("parseCodeFileBySize", () => {
	beforeEach(() => {
		// Clear mocks before each test
		mockedReadFile.mockClear()
	})

	it("should return top-level blocks within default size limits (2-100 lines)", async () => {
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
` // Note: Line numbers adjusted slightly for comments/whitespace

		// Configure the mock readFile
		mockedReadFile.mockResolvedValue(mockTsContent)

		const filePath = "dummy/path/file.ts"
		// Call with only the file path to use default options
		const result = await parseCodeFileBySize(filePath) // Use default options

		// --- Assertions ---

		// General check
		expect(result).toBeInstanceOf(Array)
		// Expecting smallFunction (3 lines) and MyClass (24 lines)
		expect(result).toHaveLength(2)

		// --- Assert smallFunction ---
		// Lines 2-4 in mock content
		const smallFunctionBlock = result.find((block) => block.identifier === "smallFunction")
		expect(smallFunctionBlock).toBeDefined()
		expect(smallFunctionBlock?.type).toBe("function_declaration")
		expect(smallFunctionBlock?.start_line).toBe(3) // Line numbers relative to the start of the mock content string
		expect(smallFunctionBlock?.end_line).toBe(5)
		expect(smallFunctionBlock?.file_path).toBe(filePath)

		// --- Assert MyClass ---
		// Lines 7-30 in mock content (24 lines total) - should be included as it fits 2-100
		const myClassBlock = result.find((block) => block.identifier === "MyClass")
		expect(myClassBlock).toBeDefined()
		expect(myClassBlock?.type).toBe("class_declaration")
		expect(myClassBlock?.start_line).toBe(8) // Line numbers relative to the start of the mock content string
		expect(myClassBlock?.end_line).toBe(31)
		expect(myClassBlock?.content).toContain("mediumMethod()") // Check content includes nested parts
		expect(myClassBlock?.content).toContain("constructor()")
		expect(myClassBlock?.content).toContain("anotherMethod()")
		expect(myClassBlock?.file_path).toBe(filePath)

		// --- Assert nested blocks are NOT returned individually ---
		const mediumMethodBlock = result.find((block) => block.identifier === "mediumMethod")
		expect(mediumMethodBlock).toBeUndefined()
		const constructorBlock = result.find((block) => block.identifier === "constructor")
		expect(constructorBlock).toBeUndefined()
		const anotherMethodBlock = result.find((block) => block.identifier === "anotherMethod")
		expect(anotherMethodBlock).toBeUndefined()

		// Verify readFile was called correctly
		expect(mockedReadFile).toHaveBeenCalledTimes(1)
		expect(mockedReadFile).toHaveBeenCalledWith(filePath, "utf-8")
	})

	// Add more test cases here for edge cases, different languages, errors, etc.
})
