import * as path from "path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers, readFileContent } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse } from "../assistant-message"

// Mock dependencies
jest.mock("../../integrations/misc/line-counter")
jest.mock("../../integrations/misc/read-lines")
jest.mock("../../integrations/misc/extract-text", () => ({
	extractTextFromFile: jest.fn(),
	addLineNumbers: jest.fn(),
	readFileContent: jest.fn(),
}))
jest.mock("../../services/tree-sitter")
jest.mock("isbinaryfile")
jest.mock("../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockResolvedValue("{}"),
}))
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockReturnValue(true),
}))

// Mock path
jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

describe("read_file tool with maxReadFileLine setting", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"
	const expectedFullFileXml = `<file>\n  <path>${testFilePath}</path>\n  <content>\n${numberedFileContent}\n  </content>\n</file>`

	// Mocked functions with correct types
	const mockedCountFileLines = countFileLines as jest.MockedFunction<typeof countFileLines>
	const mockedReadLines = readLines as jest.MockedFunction<typeof readLines>
	const mockedExtractTextFromFile = extractTextFromFile as jest.MockedFunction<typeof extractTextFromFile>
	const mockedReadFileContent = readFileContent as jest.MockedFunction<typeof readFileContent>
	const mockedAddLineNumbers = addLineNumbers as jest.MockedFunction<typeof addLineNumbers>
	const mockedParseSourceCodeDefinitionsForFile = parseSourceCodeDefinitionsForFile as jest.MockedFunction<
		typeof parseSourceCodeDefinitionsForFile
	>
	const mockedIsBinaryFile = isBinaryFile as jest.MockedFunction<typeof isBinaryFile>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>

	// Mock instances
	const mockCline: any = {}
	let mockProvider: any
	let toolResult: string | undefined

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup path resolution
		mockedPathResolve.mockReturnValue(absoluteFilePath)

		// Setup mocks for file operations
		mockedIsBinaryFile.mockResolvedValue(false)
		mockedAddLineNumbers.mockImplementation((content: string, startLine = 1) => {
			return content
				.split("\n")
				.map((line, i) => `${i + startLine} | ${line}`)
				.join("\n")
		})

		// Setup mock provider
		mockProvider = {
			getState: jest.fn(),
			deref: jest.fn().mockReturnThis(),
		}

		// Setup Cline instance with mock methods
		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: jest.fn().mockReturnValue(true),
		}
		mockCline.say = jest.fn().mockResolvedValue(undefined)
		mockCline.ask = jest.fn().mockResolvedValue(true)
		mockCline.presentAssistantMessage = jest.fn()

		// Reset tool result
		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with different maxReadFileLine settings
	 */
	async function executeReadFileTool(
		maxReadFileLine: number,
		totalLines = 5,
		isBinary = false,
	): Promise<string | undefined> {
		// Configure mocks based on test scenario
		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)
		mockedIsBinaryFile.mockResolvedValue(isBinary)

		// Setup readFileContent mock to return the expected result with truncation message if needed
		if (isBinary) {
			// For binary files, always return the full content without truncation
			mockedReadFileContent.mockResolvedValue(numberedFileContent)
		} else if (maxReadFileLine !== undefined && maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
			const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			if (maxReadFileLine === 0) {
				// For maxReadFileLine = 0, return empty content with truncation message and source code definitions
				mockedReadFileContent.mockResolvedValue(
					`[Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more]${sourceCodeDef}`,
				)
			} else {
				// For other truncation cases, return partial content with truncation message and source code definitions
				mockedReadFileContent.mockResolvedValue(
					`${numberedFileContent}\n\n[Showing only ${maxReadFileLine} of ${totalLines} total lines. Use start_line and end_line if you need to read more]${sourceCodeDef}`,
				)
			}
		} else {
			// For non-truncation cases, return the full content
			mockedReadFileContent.mockResolvedValue(numberedFileContent)
		}

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { path: testFilePath },
			partial: false,
		}

		// Import the tool implementation dynamically to avoid hoisting issues
		const { readFileTool } = require("../tools/readFileTool")

		// Execute the tool
		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			jest.fn(),
			(result: string) => {
				toolResult = result
			},
			(param: string, value: string) => value,
		)

		return toolResult
	}

	describe("when maxReadFileLine is negative", () => {
		it("should read the entire file using extractTextFromFile", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool(-1)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: -1,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toBe(expectedFullFileXml)
		})
	})

	describe("when maxReadFileLine is 0", () => {
		it("should return an empty content with source code definitions", async () => {
			// Execute
			const result = await executeReadFileTool(0)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: 0,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toContain("[Showing only 0 of 5 total lines")
			expect(result).toContain(sourceCodeDef)
		})
	})

	describe("when maxReadFileLine is less than file length", () => {
		it("should read only maxReadFileLine lines and add source code definitions", async () => {
			// Execute
			const result = await executeReadFileTool(3)

			// Verify - check behavior but not specific implementation details
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: 3,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toContain("1 | Line 1")
			expect(result).toContain("2 | Line 2")
			expect(result).toContain("3 | Line 3")
			expect(result).toContain("[Showing only 3 of 5 total lines")
			expect(result).toContain(sourceCodeDef)
		})
	})

	describe("when maxReadFileLine equals or exceeds file length", () => {
		it("should use extractTextFromFile when maxReadFileLine > totalLines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(5) // File shorter than maxReadFileLine
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool(10, 5)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: 10,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toBe(expectedFullFileXml)
		})

		it("should read with extractTextFromFile when file has few lines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(3) // File shorter than maxReadFileLine
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool(5, 3)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: 5,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toBe(expectedFullFileXml)
		})
	})

	describe("when file is binary", () => {
		it("should always use extractTextFromFile regardless of maxReadFileLine", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute - pass true for isBinary parameter
			const result = await executeReadFileTool(3, 5, true)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: 3,
				startLine: undefined,
				endLine: undefined,
				rooIgnoreController: mockCline.rooIgnoreController,
			})
			expect(result).toBe(expectedFullFileXml)
		})
	})

	describe("with range parameters", () => {
		it("should honor start_line and end_line when provided", async () => {
			// Setup
			const rangeToolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: testFilePath,
					start_line: "2",
					end_line: "4",
				},
				partial: false,
			}

			mockedReadLines.mockResolvedValue("Line 2\nLine 3\nLine 4")

			// Import the tool implementation dynamically
			const { readFileTool } = require("../tools/readFileTool")

			// Execute the tool
			let rangeResult: string | undefined
			await readFileTool(
				mockCline,
				rangeToolUse,
				mockCline.ask,
				jest.fn(),
				(result: string) => {
					rangeResult = result
				},
				(param: string, value: string) => value,
			)

			// Verify
			expect(mockedReadFileContent).toHaveBeenCalledWith(absoluteFilePath, {
				maxReadFileLine: expect.any(Number),
				startLine: 1, // start_line - 1
				endLine: 3, // end_line - 1
				rooIgnoreController: mockCline.rooIgnoreController,
			})
		})
	})
})
