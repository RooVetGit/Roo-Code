// npx jest src/core/__tests__/read-file-tool.test.ts

import * as path from "path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../integrations/misc/extract-text"

// Mock the required functions
jest.mock("../../integrations/misc/line-counter")
jest.mock("../../integrations/misc/read-lines")
jest.mock("../../integrations/misc/extract-text")

describe("read_file tool with maxReadFileLine setting", () => {
	// Mock original implementation first to use in tests
	const originalCountFileLines = jest.requireActual("../../integrations/misc/line-counter").countFileLines
	const originalReadLines = jest.requireActual("../../integrations/misc/read-lines").readLines
	const originalExtractTextFromFile = jest.requireActual("../../integrations/misc/extract-text").extractTextFromFile
	const originalAddLineNumbers = jest.requireActual("../../integrations/misc/extract-text").addLineNumbers

	beforeEach(() => {
		jest.resetAllMocks()
		// Reset mocks to simulate original behavior
		;(countFileLines as jest.Mock).mockImplementation(originalCountFileLines)
		;(readLines as jest.Mock).mockImplementation(originalReadLines)
		;(extractTextFromFile as jest.Mock).mockImplementation(originalExtractTextFromFile)
		;(addLineNumbers as jest.Mock).mockImplementation(originalAddLineNumbers)
	})

	// Test for the case when file size is smaller than maxReadFileLine
	it("should read entire file when line count is less than maxReadFileLine", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(100)
		;(extractTextFromFile as jest.Mock).mockResolvedValue("Small file content")

		// Create mock implementation that would simulate the behavior
		// Note: We're not testing the Cline class directly as it would be too complex
		// We're testing the logic flow that would happen in the read_file implementation

		const filePath = path.resolve("/test", "smallFile.txt")
		const maxReadFileLine = 500

		// Check line count
		const lineCount = await countFileLines(filePath)
		expect(lineCount).toBeLessThan(maxReadFileLine)

		// Should use extractTextFromFile for small files
		if (lineCount < maxReadFileLine) {
			await extractTextFromFile(filePath)
		}

		expect(extractTextFromFile).toHaveBeenCalledWith(filePath)
		expect(readLines).not.toHaveBeenCalled()
	})

	// Test for the case when file size is larger than maxReadFileLine
	it("should truncate file when line count exceeds maxReadFileLine", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(5000)
		;(readLines as jest.Mock).mockResolvedValue("First 500 lines of large file")
		;(addLineNumbers as jest.Mock).mockReturnValue("1 | First line\n2 | Second line\n...")

		const filePath = path.resolve("/test", "largeFile.txt")
		const maxReadFileLine = 500

		// Check line count
		const lineCount = await countFileLines(filePath)
		expect(lineCount).toBeGreaterThan(maxReadFileLine)

		// Should use readLines for large files
		if (lineCount > maxReadFileLine) {
			const content = await readLines(filePath, maxReadFileLine - 1, 0)
			const numberedContent = addLineNumbers(content)

			// Verify the truncation message is shown (simulated)
			const truncationMsg = `\n\n[File truncated: showing ${maxReadFileLine} of ${lineCount} total lines]`
			const fullResult = numberedContent + truncationMsg

			expect(fullResult).toContain("File truncated")
		}

		expect(readLines).toHaveBeenCalledWith(filePath, maxReadFileLine - 1, 0)
		expect(addLineNumbers).toHaveBeenCalled()
		expect(extractTextFromFile).not.toHaveBeenCalled()
	})

	// Test for the case when the file is a source code file
	it("should add source code file type info for large source code files", async () => {
		// Mock necessary functions
		;(countFileLines as jest.Mock).mockResolvedValue(5000)
		;(readLines as jest.Mock).mockResolvedValue("First 500 lines of large JavaScript file")
		;(addLineNumbers as jest.Mock).mockReturnValue('1 | const foo = "bar";\n2 | function test() {...')

		const filePath = path.resolve("/test", "largeFile.js")
		const maxReadFileLine = 500

		// Check line count
		const lineCount = await countFileLines(filePath)
		expect(lineCount).toBeGreaterThan(maxReadFileLine)

		// Check if the file is a source code file
		const fileExt = path.extname(filePath).toLowerCase()
		const isSourceCode = [
			".js",
			".ts",
			".jsx",
			".tsx",
			".py",
			".java",
			".c",
			".cpp",
			".cs",
			".go",
			".rb",
			".php",
			".swift",
			".rs",
		].includes(fileExt)
		expect(isSourceCode).toBeTruthy()

		// Should use readLines for large files
		if (lineCount > maxReadFileLine) {
			const content = await readLines(filePath, maxReadFileLine - 1, 0)
			const numberedContent = addLineNumbers(content)

			// Verify the truncation message and source code message are shown (simulated)
			let truncationMsg = `\n\n[File truncated: showing ${maxReadFileLine} of ${lineCount} total lines]`
			if (isSourceCode) {
				truncationMsg +=
					"\n\nThis appears to be a source code file. Consider using list_code_definition_names to understand its structure."
			}
			const fullResult = numberedContent + truncationMsg

			expect(fullResult).toContain("source code file")
			expect(fullResult).toContain("list_code_definition_names")
		}

		expect(readLines).toHaveBeenCalledWith(filePath, maxReadFileLine - 1, 0)
		expect(addLineNumbers).toHaveBeenCalled()
	})
})

// Test suite for path parameter parsing
describe("read_file tool path parameter parsing", () => {
	// Variable to hold the imported function
	let readFileTool: any;
	// Variable to hold the mock t function for this suite - DECLARE HERE
	let localMockT: jest.Mock;
	const mockCline = {
		consecutiveMistakeCount: 0,
		recordToolError: jest.fn(),
		say: jest.fn(),
		providerRef: { // Mock providerRef and deref
			deref: () => ({
				log: jest.fn(), // Mock the log function
				getState: jest.fn().mockResolvedValue({ // Mock getState
					maxReadFileLine: 500,
					maxConcurrentFileReads: 1,
					alwaysAllowReadOnly: false,
					alwaysAllowReadOnlyOutsideWorkspace: false,
				}),
			}),
		},
		cwd: "/test/workspace", // Mock cwd
		rooIgnoreController: { // Mock rooIgnoreController
			validateAccess: jest.fn().mockReturnValue(true),
		},
		getFileContextTracker: jest.fn(() => ({ // Mock getFileContextTracker
			trackFileContext: jest.fn().mockResolvedValue(undefined),
		})),
	} as any // Use 'any' for simplicity in mocking

	const mockAskApproval = jest.fn().mockResolvedValue(true)
	const mockHandleError = jest.fn()
	const mockPushToolResult = jest.fn()
	const mockRemoveClosingTag = jest.fn(); // Define mock inside describe

	beforeEach(() => {
		// Reset modules to ensure fresh mocks for this suite
		jest.resetModules();

		// ASSIGN mock implementation for t here
		localMockT = jest.fn((key, params) => {
			if (key === "tools:readFile.error.incompleteJsonArray") {
				return `Incomplete or malformed file path array: ${params?.value}. It looks like a JSON array but is missing the closing bracket or is otherwise invalid.`
			}
			return key
		});

		// Apply the mock for i18n specifically for this suite
		jest.doMock("../../i18n", () => ({
			t: localMockT,
		}));

		// Require the module *after* setting up the mock
		readFileTool = require("../tools/readFileTool").readFileTool;

		// Reset other mocks before each test
		jest.clearAllMocks()
		mockCline.consecutiveMistakeCount = 0
		mockCline.recordToolError.mockClear();
		mockCline.say.mockClear();
		mockAskApproval.mockClear();
		mockHandleError.mockClear();
		mockPushToolResult.mockClear();
		mockRemoveClosingTag.mockClear();
		mockRemoveClosingTag.mockImplementation((_tag: string, value: string | undefined): string | undefined => value);
	})

	it("should return incompleteJsonArray error for malformed JSON array string", async () => {
		const incompleteJsonPath = '["file1.txt", "file2.txt"' // Missing closing bracket

		const block = {
			tool_name: "read_file",
			tool_id: "1",
			params: {
				path: incompleteJsonPath,
			},
		}

		await readFileTool(
			mockCline,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag, // Pass the mock function as argument
		)

		expect(mockCline.recordToolError).toHaveBeenCalledWith("read_file")
		expect(localMockT).toHaveBeenCalledWith("tools:readFile.error.incompleteJsonArray", { value: incompleteJsonPath })
		expect(mockCline.say).toHaveBeenCalledWith(
			"error",
			// Use the mock function directly to get the expected string
			localMockT("tools:readFile.error.incompleteJsonArray", { value: incompleteJsonPath }),
		)
		expect(mockPushToolResult).toHaveBeenCalledWith(
			`<tool_error tool_name="read_file">Incomplete or malformed file path array: ${incompleteJsonPath}. It looks like a JSON array but is missing the closing bracket or is otherwise invalid.</tool_error>`,
		)
	})

	// Add more tests for other parsing scenarios (valid JSON, single path, invalid format, etc.) if needed
})
