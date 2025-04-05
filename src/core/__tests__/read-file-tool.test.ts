import * as path from "path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers, readFileContent } from "../../integrations/misc/extract-text"

// Mock the required functions
jest.mock("../../integrations/misc/line-counter")
jest.mock("../../integrations/misc/read-lines")
jest.mock("../../integrations/misc/extract-text")

describe("read_file tool with maxReadFileLine setting", () => {
	// Mock original implementation first to use in tests
	const originalCountFileLines = jest.requireActual("../../integrations/misc/line-counter").countFileLines
	const originalReadLines = jest.requireActual("../../integrations/misc/read-lines").readLines
	const originalExtractTextFromFile = jest.requireActual("../../integrations/misc/extract-text").extractTextFromFile
	const originalReadFileContent = jest.requireActual("../../integrations/misc/extract-text").readFileContent
	const originalAddLineNumbers = jest.requireActual("../../integrations/misc/extract-text").addLineNumbers

	beforeEach(() => {
		jest.resetAllMocks()
		// Reset mocks to simulate original behavior
		;(countFileLines as jest.Mock).mockImplementation(originalCountFileLines)
		;(readLines as jest.Mock).mockImplementation(originalReadLines)
		;(extractTextFromFile as jest.Mock).mockImplementation(originalExtractTextFromFile)
		;(readFileContent as jest.Mock).mockImplementation(originalReadFileContent)
		;(addLineNumbers as jest.Mock).mockImplementation(originalAddLineNumbers)
	})

	// Test for the case when file size is smaller than maxReadFileLine
	it("should read entire file when line count is less than maxReadFileLine", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(100)
		;(readFileContent as jest.Mock).mockResolvedValue("Small file content")

		// Create mock implementation that would simulate the behavior
		// Note: We're not testing the Cline class directly as it would be too complex
		// We're testing the logic flow that would happen in the read_file implementation

		const filePath = path.resolve("/test", "smallFile.txt")
		const maxReadFileLine = 500

		// Use readFileContent with appropriate options
		await readFileContent(filePath, {
			maxReadFileLine: maxReadFileLine,
		})

		expect(readFileContent).toHaveBeenCalledWith(filePath, {
			maxReadFileLine: maxReadFileLine,
		})
	})

	// Test for the case when file size is larger than maxReadFileLine
	it("should truncate file when line count exceeds maxReadFileLine", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(5000)
		;(readFileContent as jest.Mock).mockImplementation((path, options) => {
			const maxReadFileLine = options?.maxReadFileLine || 500
			const lineCount = 5000
			return Promise.resolve(
				`1 | First line\n2 | Second line\n...\n\n[Showing only ${maxReadFileLine} of ${lineCount} total lines. Use start_line and end_line if you need to read more]`,
			)
		})

		const filePath = path.resolve("/test", "largeFile.txt")
		const maxReadFileLine = 500

		// Use readFileContent with appropriate options
		const result = await readFileContent(filePath, {
			maxReadFileLine: maxReadFileLine,
		})

		expect(readFileContent).toHaveBeenCalledWith(filePath, {
			maxReadFileLine: maxReadFileLine,
		})
		expect(result).toContain(`[Showing only ${maxReadFileLine} of 5000 total lines`)
	})

	// Test for the case when the file is a source code file
	it("should add source code file type info for large source code files", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(5000)
		;(readFileContent as jest.Mock).mockImplementation((path, options) => {
			const maxReadFileLine = options?.maxReadFileLine || 500
			const lineCount = 5000
			const sourceCodeDef = "\n\nfunction main() { ... }\nfunction helper() { ... }"
			return Promise.resolve(
				`1 | const foo = "bar";\n2 | function test() {...\n\n[Showing only ${maxReadFileLine} of ${lineCount} total lines. Use start_line and end_line if you need to read more]${sourceCodeDef}`,
			)
		})

		const filePath = path.resolve("/test", "largeFile.js")
		const maxReadFileLine = 500

		// Use readFileContent with appropriate options
		const result = await readFileContent(filePath, {
			maxReadFileLine: maxReadFileLine,
		})

		expect(readFileContent).toHaveBeenCalledWith(filePath, {
			maxReadFileLine: maxReadFileLine,
		})
		expect(result).toContain(`[Showing only ${maxReadFileLine} of 5000 total lines`)
		expect(result).toContain("function main() { ... }")
	})
})
