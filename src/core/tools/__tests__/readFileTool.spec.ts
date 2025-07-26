// npx vitest src/core/tools/__tests__/readFileTool.spec.ts

import * as path from "path"
import { stat } from "fs/promises"

import { countFileLines } from "../../../integrations/misc/line-counter"
import { readLines } from "../../../integrations/misc/read-lines"
import { extractTextFromFile } from "../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse, ToolParamName, ToolResponse } from "../../../shared/tools"
import { readFileTool } from "../readFileTool"
import { formatResponse } from "../../prompts/responses"
import { tiktoken } from "../../../utils/tiktoken"

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		default: originalPath,
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => args.join("/")),
	}
})

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("{}"),
	stat: vi.fn().mockResolvedValue({ size: 1024 }), // Default 1KB file
}))

vi.mock("isbinaryfile")

vi.mock("../../../integrations/misc/line-counter")
vi.mock("../../../integrations/misc/read-lines")

// Mock input content for tests
let mockInputContent = ""

// First create all the mocks
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn(),
	addLineNumbers: vi.fn(),
	getSupportedBinaryFormats: vi.fn(() => [".pdf", ".docx", ".ipynb"]),
}))
vi.mock("../../../services/tree-sitter")
vi.mock("../../../utils/tiktoken")

// Import the mocked functions
import { addLineNumbers, getSupportedBinaryFormats } from "../../../integrations/misc/extract-text"

// Then create the mock functions
const addLineNumbersMock = vi.mocked(addLineNumbers)
addLineNumbersMock.mockImplementation((text: string, startLine = 1) => {
	if (!text) return ""
	const lines = typeof text === "string" ? text.split("\n") : [text]
	return lines.map((line: string, i: number) => `${startLine + i} | ${line}`).join("\n")
})

const extractTextFromFileMock = vi.mocked(extractTextFromFile)
const getSupportedBinaryFormatsMock = vi.mocked(getSupportedBinaryFormats)

vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(true),
}))

describe("read_file tool with maxReadFileLine setting", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5\n"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

	// Mocked functions with correct types
	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedReadLines = vi.mocked(readLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedParseSourceCodeDefinitionsForFile = vi.mocked(parseSourceCodeDefinitionsForFile)

	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		mockInputContent = fileContent

		// Setup the extractTextFromFile mock implementation with the current mockInputContent
		// Reset the spy before each test
		addLineNumbersMock.mockClear()

		// Setup the extractTextFromFile mock to call our spy
		mockedExtractTextFromFile.mockImplementation((_filePath) => {
			// Call the spy and return its result
			return Promise.resolve(addLineNumbersMock(mockInputContent))
		})

		mockProvider = {
			getState: vi.fn(),
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.presentAssistantMessage = vi.fn()
		mockCline.handleError = vi.fn().mockResolvedValue(undefined)
		mockCline.pushToolResult = vi.fn()
		mockCline.removeClosingTag = vi.fn((tag, content) => content)

		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}

		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)

		// Add default api mock
		mockCline.api = {
			getModel: vi.fn().mockReturnValue({
				info: {
					contextWindow: 100000,
				},
			}),
		}

		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with different maxReadFileLine settings
	 */
	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: {
			maxReadFileLine?: number
			totalLines?: number
			skipAddLineNumbersCheck?: boolean // Flag to skip addLineNumbers check
			path?: string
			start_line?: string
			end_line?: string
		} = {},
	): Promise<ToolResponse | undefined> {
		// Configure mocks based on test scenario
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const totalLines = options.totalLines ?? 5

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)

		// Reset the spy before each test
		addLineNumbersMock.mockClear()

		// Format args string based on params
		let argsContent = `<file><path>${options.path || testFilePath}</path>`
		if (options.start_line && options.end_line) {
			argsContent += `<line_range>${options.start_line}-${options.end_line}</line_range>`
		}
		argsContent += `</file>`

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(_: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("when maxReadFileLine is negative", () => {
		it("should read the entire file using extractTextFromFile", async () => {
			// Setup - use default mockInputContent
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
		})

		it("should not show line snippet in approval message when maxReadFileLine is -1", async () => {
			// This test verifies the line snippet behavior for the approval message
			// Setup - use default mockInputContent
			mockInputContent = fileContent

			// Execute - we'll reuse executeReadFileTool to run the tool
			await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify the empty line snippet for full read was passed to the approval message
			// Look at the parameters passed to the 'ask' method in the approval message
			const askCall = mockCline.ask.mock.calls[0]
			const completeMessage = JSON.parse(askCall[1])

			// Verify the reason (lineSnippet) is empty or undefined for full read
			expect(completeMessage.reason).toBeFalsy()
		})
	})

	describe("when maxReadFileLine is 0", () => {
		it("should return an empty content with source code definitions", async () => {
			// Setup - for maxReadFileLine = 0, the implementation won't call readLines
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute - skip addLineNumbers check as it's not called for maxReadFileLine=0
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: 0,
					totalLines: 5,
					skipAddLineNumbersCheck: true,
				},
			)

			// Verify
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<list_code_definition_names>`)

			// Verify XML structure
			expect(result).toContain("<notice>Showing only 0 of 5 total lines")
			expect(result).toContain("</notice>")
			expect(result).toContain("<list_code_definition_names>")
			expect(result).toContain(sourceCodeDef.trim())
			expect(result).toContain("</list_code_definition_names>")
			expect(result).not.toContain("<content") // No content when maxReadFileLine is 0
		})
	})

	describe("when maxReadFileLine is less than file length", () => {
		it("should read only maxReadFileLine lines and add source code definitions", async () => {
			// Setup
			const content = "Line 1\nLine 2\nLine 3"
			const numberedContent = "1 | Line 1\n2 | Line 2\n3 | Line 3"
			mockedReadLines.mockResolvedValue(content)
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Setup addLineNumbers to always return numbered content
			addLineNumbersMock.mockReturnValue(numberedContent)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 3 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-3">`)
			expect(result).toContain(`<list_code_definition_names>`)
			expect(result).toContain("<notice>Showing only 3 of 5 total lines")
		})
	})

	describe("when maxReadFileLine equals or exceeds file length", () => {
		it("should use extractTextFromFile when maxReadFileLine > totalLines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(5) // File shorter than maxReadFileLine
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 10, totalLines: 5 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
		})

		it("should read with extractTextFromFile when file has few lines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(3) // File shorter than maxReadFileLine
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 5, totalLines: 3 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-3">`)
		})
	})

	describe("when file is binary", () => {
		it("should always use extractTextFromFile regardless of maxReadFileLine", async () => {
			// Setup
			mockedIsBinaryFile.mockResolvedValue(true)
			mockedCountFileLines.mockResolvedValue(3)
			mockedExtractTextFromFile.mockResolvedValue("")

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 3, totalLines: 3 })

			// Verify - just check basic structure, the actual binary handling may vary
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(typeof result).toBe("string")
		})
	})

	describe("with range parameters", () => {
		it("should honor start_line and end_line when provided", async () => {
			// Setup
			mockedReadLines.mockResolvedValue("Line 2\nLine 3\nLine 4")

			// Execute using executeReadFileTool with range parameters
			const rangeResult = await executeReadFileTool(
				{},
				{
					start_line: "2",
					end_line: "4",
				},
			)

			// Verify - just check that the result contains the expected elements
			expect(rangeResult).toContain(`<file><path>${testFilePath}</path>`)
			expect(rangeResult).toContain(`<content lines="2-4">`)
		})
	})
})

describe("read_file tool XML output structure", () => {
	// Test basic XML structure
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"

	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		// Set default implementation for extractTextFromFile
		mockedExtractTextFromFile.mockImplementation((filePath) => {
			return Promise.resolve(addLineNumbersMock(mockInputContent))
		})

		mockInputContent = fileContent

		// Setup mock provider with default maxReadFileLine
		mockProvider = {
			getState: vi.fn().mockResolvedValue({ maxReadFileLine: -1 }), // Default to full file read
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.presentAssistantMessage = vi.fn()
		mockCline.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing required parameter")

		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}

		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)
		mockCline.didRejectTool = false

		// Add default api mock
		mockCline.api = {
			getModel: vi.fn().mockReturnValue({
				info: {
					contextWindow: 100000,
				},
			}),
		}

		toolResult = undefined
	})

	async function executeReadFileTool(
		params: {
			args?: string
		} = {},
		options: {
			totalLines?: number
			maxReadFileLine?: number
			isBinary?: boolean
			validateAccess?: boolean
		} = {},
	): Promise<ToolResponse | undefined> {
		// Configure mocks based on test scenario
		const totalLines = options.totalLines ?? 5
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const isBinary = options.isBinary ?? false
		const validateAccess = options.validateAccess ?? true

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)
		mockedIsBinaryFile.mockResolvedValue(isBinary)
		mockCline.rooIgnoreController.validateAccess = vi.fn().mockReturnValue(validateAccess)

		let argsContent = `<file><path>${testFilePath}</path></file>`

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		// Execute the tool
		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(param: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("Basic XML Structure Tests", () => {
		it("should produce XML output with no unnecessary indentation", async () => {
			// Setup
			const numberedContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5"
			// For XML structure test
			mockedExtractTextFromFile.mockImplementation(() => {
				addLineNumbersMock(mockInputContent)
				return Promise.resolve(numberedContent)
			})
			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedContent}</content>\n</file>\n</files>`,
			)
		})

		it("should follow the correct XML structure format", async () => {
			// Setup
			mockInputContent = fileContent
			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify using regex to check structure
			const xmlStructureRegex = new RegExp(
				`^<files>\\n<file><path>${testFilePath}</path>\\n<content lines="1-5">\\n.*</content>\\n</file>\\n</files>$`,
				"s",
			)
			expect(result).toMatch(xmlStructureRegex)
		})

		it("should handle empty files correctly", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(0)
			mockedExtractTextFromFile.mockResolvedValue("")
			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })

			// Execute
			const result = await executeReadFileTool({}, { totalLines: 0 })

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>\n</files>`,
			)
		})
	})

	describe("Error Handling Tests", () => {
		it("should include error tag for invalid path", async () => {
			// Setup - missing path parameter
			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {},
				partial: false,
			}

			// Execute the tool
			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				vi.fn(),
				(result: ToolResponse) => {
					toolResult = result
				},
				(param: ToolParamName, content?: string) => content ?? "",
			)

			// Verify
			expect(toolResult).toBe(`<files><error>Missing required parameter</error></files>`)
		})

		it("should include error tag for RooIgnore error", async () => {
			// Execute - skip addLineNumbers check as it returns early with an error
			const result = await executeReadFileTool({}, { validateAccess: false })

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path><error>Access to ${testFilePath} is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file.</error></file>\n</files>`,
			)
		})
	})
})

describe("read_file tool with large file safeguard", () => {
	// Test data
	const testFilePath = "test/largefile.txt"
	const absoluteFilePath = "/test/largefile.txt"

	// Mocked functions
	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedReadLines = vi.mocked(readLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)
	const mockedTiktoken = vi.mocked(tiktoken)
	const mockedStat = vi.mocked(stat)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		mockProvider = {
			getState: vi.fn(),
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}
		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)

		// Add default api mock
		mockCline.api = {
			getModel: vi.fn().mockReturnValue({
				info: {
					contextWindow: 100000,
				},
			}),
		}

		toolResult = undefined
	})

	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: {
			maxReadFileLine?: number
			totalLines?: number
			tokenCount?: number
			fileSize?: number
		} = {},
	): Promise<ToolResponse | undefined> {
		const maxReadFileLine = options.maxReadFileLine ?? -1
		const totalLines = options.totalLines ?? 5
		const tokenCount = options.tokenCount ?? 100
		const fileSize = options.fileSize ?? 1024 // Default 1KB

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)
		mockedTiktoken.mockResolvedValue(tokenCount)
		mockedStat.mockResolvedValue({ size: fileSize } as any)

		const argsContent = `<file><path>${testFilePath}</path></file>`

		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(_: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("when file has large size and high token count", () => {
		it("should apply safeguard and read only first 2000 lines", async () => {
			// Setup - large file with high token count
			const largeFileContent = Array(15000).fill("This is a line of text").join("\n")
			const partialContent = Array(2000).fill("This is a line of text").join("\n")

			mockedExtractTextFromFile.mockResolvedValue(largeFileContent)
			mockedReadLines.mockResolvedValue(partialContent)

			// Setup addLineNumbers mock for this test
			addLineNumbersMock.mockImplementation((text: string) => {
				const lines = text.split("\n")
				return lines.map((line: string, i: number) => `${i + 1} | ${line}`).join("\n")
			})

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Execute with large file size and high token count
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: -1,
					totalLines: 15000,
					tokenCount: 60000, // Above threshold
					fileSize: 200 * 1024, // 200KB - above threshold
				},
			)

			// Verify safeguard was applied
			expect(mockedTiktoken).toHaveBeenCalled()
			expect(mockedReadLines).toHaveBeenCalledWith(absoluteFilePath, 1999, 0)

			// Verify the result contains the safeguard notice
			expect(result).toContain("<notice>This file is 200KB and contains approximately 60,000 tokens")
			expect(result).toContain("Showing only the first 2000 lines to preserve context space")
			expect(result).toContain(`<content lines="1-2000">`)
		})

		it("should not apply safeguard when token count is below threshold", async () => {
			// Setup - large file but with low token count
			const fileContent = Array(15000).fill("Short").join("\n")
			const numberedContent = fileContent
				.split("\n")
				.map((line, i) => `${i + 1} | ${line}`)
				.join("\n")

			mockedExtractTextFromFile.mockImplementation(() => Promise.resolve(numberedContent))

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Execute with large file size but low token count
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: -1,
					totalLines: 15000,
					tokenCount: 30000, // Below threshold
					fileSize: 200 * 1024, // 200KB - above threshold
				},
			)

			// Verify safeguard was NOT applied
			expect(mockedTiktoken).toHaveBeenCalled()
			expect(mockedReadLines).not.toHaveBeenCalled()
			expect(mockedExtractTextFromFile).toHaveBeenCalled()

			// Verify no safeguard notice
			expect(result).not.toContain("preserve context space")
			expect(result).toContain(`<content lines="1-15000">`)
		})

		it("should not apply safeguard for small files", async () => {
			// Setup - small file
			const fileContent = Array(999).fill("This is a line of text").join("\n")
			const numberedContent = fileContent
				.split("\n")
				.map((line, i) => `${i + 1} | ${line}`)
				.join("\n")

			mockedExtractTextFromFile.mockImplementation(() => Promise.resolve(numberedContent))

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Execute with small file size
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: -1,
					totalLines: 999,
					tokenCount: 100000, // Even with high token count
					fileSize: 50 * 1024, // 50KB - below threshold
				},
			)

			// Verify tiktoken was NOT called (optimization)
			expect(mockedTiktoken).not.toHaveBeenCalled()
			expect(mockedReadLines).not.toHaveBeenCalled()
			expect(mockedExtractTextFromFile).toHaveBeenCalled()

			// Verify no safeguard notice
			expect(result).not.toContain("preserve context space")
			expect(result).toContain(`<content lines="1-999">`)
		})

		it("should apply safeguard for very large files even if token counting fails", async () => {
			// Setup - very large file and token counting fails
			const partialContent = Array(2000).fill("This is a line of text").join("\n")

			mockedExtractTextFromFile.mockResolvedValue("Large content")
			mockedReadLines.mockResolvedValue(partialContent)

			// Setup addLineNumbers mock for partial content
			addLineNumbersMock.mockImplementation((text: string) => {
				const lines = text.split("\n")
				return lines.map((line: string, i: number) => `${i + 1} | ${line}`).join("\n")
			})

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Set up the provider state
			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })
			mockedCountFileLines.mockResolvedValue(6000)
			mockedStat.mockResolvedValue({ size: 2 * 1024 * 1024 } as any) // 2MB file

			// IMPORTANT: Set up tiktoken to reject AFTER other mocks are set
			mockedTiktoken.mockRejectedValue(new Error("Token counting failed"))

			const argsContent = `<file><path>${testFilePath}</path></file>`

			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: { args: argsContent },
				partial: false,
			}

			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				vi.fn(),
				(result: ToolResponse) => {
					toolResult = result
				},
				(_: ToolParamName, content?: string) => content ?? "",
			)

			// Verify safeguard was applied despite token counting failure
			expect(mockedTiktoken).toHaveBeenCalled()
			expect(mockedReadLines).toHaveBeenCalledWith(absoluteFilePath, 1999, 0)

			// Verify the result contains the safeguard notice (without token count)
			expect(toolResult).toContain("<notice>This file is 2048KB")
			expect(toolResult).toContain("Showing only the first 2000 lines to preserve context space")
			expect(toolResult).toContain(`<content lines="1-2000">`)
		})

		it("should not apply safeguard when maxReadFileLine is not -1", async () => {
			// Setup
			const fileContent = Array(20000).fill("This is a line of text").join("\n")
			mockedExtractTextFromFile.mockResolvedValue(fileContent)

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Execute with maxReadFileLine = 500 (not -1)
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: 500,
					totalLines: 20000,
					tokenCount: 100000,
					fileSize: 2 * 1024 * 1024, // 2MB
				},
			)

			// Verify tiktoken was NOT called
			expect(mockedTiktoken).not.toHaveBeenCalled()

			// The normal maxReadFileLine logic should apply
			expect(mockedReadLines).toHaveBeenCalled()
		})

		it("should handle line ranges correctly with safeguard", async () => {
			// When line ranges are specified, safeguard should not apply
			const rangeContent = "Line 100\nLine 101\nLine 102"
			mockedReadLines.mockResolvedValue(rangeContent)

			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			const argsContent = `<file><path>${testFilePath}</path><line_range>100-102</line_range></file>`

			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: { args: argsContent },
				partial: false,
			}

			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })
			mockedCountFileLines.mockResolvedValue(10000)
			mockedStat.mockResolvedValue({ size: 10 * 1024 * 1024 } as any) // 10MB file

			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				vi.fn(),
				(result: ToolResponse) => {
					toolResult = result
				},
				(_: ToolParamName, content?: string) => content ?? "",
			)

			// Verify tiktoken was NOT called for range reads
			expect(mockedTiktoken).not.toHaveBeenCalled()
			expect(toolResult).toContain(`<content lines="100-102">`)
			expect(toolResult).not.toContain("preserve context space")
		})
	})

	describe("safeguard thresholds", () => {
		it("should use correct thresholds for file size and token count", async () => {
			// Mock the api.getModel() to return a model with context window
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}

			// Test boundary conditions

			// Just below size threshold - no token check
			await executeReadFileTool({}, { fileSize: 100 * 1024 - 1, maxReadFileLine: -1 }) // Just under 100KB
			expect(mockedTiktoken).not.toHaveBeenCalled()

			// Just above size threshold - token check performed
			vi.clearAllMocks()
			// Re-mock the api.getModel() after clearAllMocks
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}
			mockedExtractTextFromFile.mockResolvedValue("content")
			await executeReadFileTool({}, { fileSize: 100 * 1024 + 1, maxReadFileLine: -1, tokenCount: 40000 }) // Just over 100KB
			expect(mockedTiktoken).toHaveBeenCalled()

			// Token count just below threshold - no safeguard
			expect(toolResult).not.toContain("preserve context space")

			// Token count just above threshold - safeguard applied
			vi.clearAllMocks()
			// Re-mock the api.getModel() after clearAllMocks
			mockCline.api = {
				getModel: vi.fn().mockReturnValue({
					info: {
						contextWindow: 100000,
					},
				}),
			}
			mockedExtractTextFromFile.mockResolvedValue("content")
			mockedReadLines.mockResolvedValue("partial content")
			await executeReadFileTool({}, { fileSize: 100 * 1024 + 1, maxReadFileLine: -1, tokenCount: 50001 })
			expect(mockedReadLines).toHaveBeenCalled()
			expect(toolResult).toContain("preserve context space")
		})
	})
})
