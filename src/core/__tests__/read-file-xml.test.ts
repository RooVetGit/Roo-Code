import * as path from "path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse } from "../assistant-message"
import { Cline } from "../Cline"

// Mock dependencies
jest.mock("../../integrations/misc/line-counter")
jest.mock("../../integrations/misc/read-lines")
jest.mock("../../integrations/misc/extract-text")
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

describe("read_file tool XML output structure", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

	// Mocked functions with correct types
	const mockedCountFileLines = countFileLines as jest.MockedFunction<typeof countFileLines>
	const mockedReadLines = readLines as jest.MockedFunction<typeof readLines>
	const mockedExtractTextFromFile = extractTextFromFile as jest.MockedFunction<typeof extractTextFromFile>
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
			getState: jest.fn().mockResolvedValue({ maxReadFileLine: 500 }),
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
		mockCline.sayAndCreateMissingParamError = jest.fn().mockResolvedValue("Missing required parameter")

		// Reset tool result
		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with custom parameters
	 */
	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: {
			totalLines?: number
			maxReadFileLine?: number
			isBinary?: boolean
			validateAccess?: boolean
		} = {},
	): Promise<string | undefined> {
		// Configure mocks based on test scenario
		const totalLines = options.totalLines ?? 5
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const isBinary = options.isBinary ?? false
		const validateAccess = options.validateAccess ?? true

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)
		mockedIsBinaryFile.mockResolvedValue(isBinary)
		mockCline.rooIgnoreController.validateAccess = jest.fn().mockReturnValue(validateAccess)

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				path: testFilePath,
				...params,
			},
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

	describe("Basic XML Structure Tests", () => {
		it("should produce XML output with no unnecessary indentation", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).toBe(`<file><path>${testFilePath}</path><content>\n${numberedFileContent}</content></file>`)
		})

		it("should follow the correct XML structure format", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool()

			// Verify using regex to check structure
			const xmlStructureRegex = new RegExp(
				`^<file><path>${testFilePath}</path><content>\\n.*</content></file>$`,
				"s",
			)
			expect(result).toMatch(xmlStructureRegex)
		})
	})

	describe("Line Range Tests", () => {
		it("should include lines attribute when start_line is specified", async () => {
			// Setup
			const startLine = 2
			mockedReadLines.mockResolvedValue(
				fileContent
					.split("\n")
					.slice(startLine - 1)
					.join("\n"),
			)

			// Execute
			const result = await executeReadFileTool({ start_line: startLine.toString() })

			// Verify
			expect(result).toContain(`<content lines="${startLine}-5">`)
		})

		it("should include lines attribute when end_line is specified", async () => {
			// Setup
			const endLine = 3
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, endLine).join("\n"))

			// Execute
			const result = await executeReadFileTool({ end_line: endLine.toString() })

			// Verify
			expect(result).toContain(`<content lines="1-${endLine}">`)
		})

		it("should include lines attribute when both start_line and end_line are specified", async () => {
			// Setup
			const startLine = 2
			const endLine = 4
			mockedReadLines.mockResolvedValue(
				fileContent
					.split("\n")
					.slice(startLine - 1, endLine)
					.join("\n"),
			)

			// Execute
			const result = await executeReadFileTool({
				start_line: startLine.toString(),
				end_line: endLine.toString(),
			})

			// Verify
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)
		})

		it("should not include lines attribute when no range is specified", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue(numberedFileContent)

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).not.toContain(`<content lines=`)
			expect(result).toContain(`<content>\n`)
		})

		it("should include content when maxReadFileLine=0 and range is specified", async () => {
			// Setup
			const maxReadFileLine = 0
			const startLine = 2
			const endLine = 4
			const totalLines = 10

			mockedReadLines.mockResolvedValue(
				fileContent
					.split("\n")
					.slice(startLine - 1, endLine)
					.join("\n"),
			)

			// Execute
			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
					end_line: endLine.toString(),
				},
				{ maxReadFileLine, totalLines },
			)

			// Verify
			// Should include content tag with line range
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only start_line is specified", async () => {
			// Setup
			const maxReadFileLine = 0
			const startLine = 3
			const totalLines = 10

			mockedReadLines.mockResolvedValue(
				fileContent
					.split("\n")
					.slice(startLine - 1)
					.join("\n"),
			)

			// Execute
			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
				},
				{ maxReadFileLine, totalLines },
			)

			// Verify
			// Should include content tag with line range
			expect(result).toContain(`<content lines="${startLine}-${totalLines}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only end_line is specified", async () => {
			// Setup
			const maxReadFileLine = 0
			const endLine = 3
			const totalLines = 10

			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, endLine).join("\n"))

			// Execute
			const result = await executeReadFileTool(
				{
					end_line: endLine.toString(),
				},
				{ maxReadFileLine, totalLines },
			)

			// Verify
			// Should include content tag with line range
			expect(result).toContain(`<content lines="1-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include full range content when maxReadFileLine=5 and content has more than 5 lines", async () => {
			// Setup
			const maxReadFileLine = 5
			const startLine = 2
			const endLine = 8
			const totalLines = 10

			// Create mock content with 7 lines (more than maxReadFileLine)
			const rangeContent = Array(endLine - startLine + 1)
				.fill("Range line content")
				.join("\n")

			mockedReadLines.mockResolvedValue(rangeContent)

			// Execute
			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
					end_line: endLine.toString(),
				},
				{ maxReadFileLine, totalLines },
			)

			// Verify
			// Should include content tag with the full requested range (not limited by maxReadFileLine)
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)

			// Should contain all the requested lines, not just maxReadFileLine lines
			expect(result).toBeDefined()
			if (result) {
				expect(result.split("\n").length).toBeGreaterThan(maxReadFileLine)
			}
		})
	})

	describe("Notice and Definition Tags Tests", () => {
		it("should include notice tag for truncated files", async () => {
			// Setup
			const maxReadFileLine = 3
			const totalLines = 10
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, maxReadFileLine).join("\n"))

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			expect(result).toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include list_code_definition_names tag when source code definitions are available", async () => {
			// Setup
			const maxReadFileLine = 3
			const totalLines = 10
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, maxReadFileLine).join("\n"))
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			// Use regex to match the tag content regardless of whitespace
			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
		})

		it("should only have definitions, no content when maxReadFileLine=0", async () => {
			// Setup
			const maxReadFileLine = 0
			const totalLines = 10
			// Mock content with exactly 10 lines to match totalLines
			const mockContent = Array(10).fill("Line content").join("\n")
			mockedExtractTextFromFile.mockResolvedValue(mockContent)
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			expect(result).toContain(`<notice>Showing only 0 of ${totalLines} total lines`)
			// Use regex to match the tag content regardless of whitespace
			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
			expect(result).not.toContain(`<content`)
		})

		it("should handle maxReadFileLine=0 with no source code definitions", async () => {
			// Setup
			const maxReadFileLine = 0
			const totalLines = 10
			// Mock that no source code definitions are available
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue("")
			// Mock content with exactly 10 lines to match totalLines
			const mockContent = Array(10).fill("Line content").join("\n")
			mockedExtractTextFromFile.mockResolvedValue(mockContent)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			// Should include notice
			expect(result).toContain(
				`<file><path>${testFilePath}</path><notice>Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice></file>`,
			)
			// Should not include list_code_definition_names tag since there are no definitions
			expect(result).not.toContain("<list_code_definition_names>")
			// Should not include content tag for non-empty files with maxReadFileLine=0
			expect(result).not.toContain("<content")
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

			// Import the tool implementation dynamically
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

			// Verify
			expect(toolResult).toContain(`<file><path></path><error>`)
			expect(toolResult).not.toContain(`<content`)
		})

		it("should include error tag for invalid start_line", async () => {
			// Execute
			const result = await executeReadFileTool({ start_line: "invalid" })

			// Verify
			expect(result).toContain(`<file><path>${testFilePath}</path><error>Invalid start_line value</error></file>`)
			expect(result).not.toContain(`<content`)
		})

		it("should include error tag for invalid end_line", async () => {
			// Execute
			const result = await executeReadFileTool({ end_line: "invalid" })

			// Verify
			expect(result).toContain(`<file><path>${testFilePath}</path><error>Invalid end_line value</error></file>`)
			expect(result).not.toContain(`<content`)
		})

		it("should include error tag for RooIgnore error", async () => {
			// Execute
			const result = await executeReadFileTool({}, { validateAccess: false })

			// Verify
			expect(result).toContain(`<file><path>${testFilePath}</path><error>`)
			expect(result).not.toContain(`<content`)
		})
	})

	describe("Edge Cases Tests", () => {
		it("should handle empty files correctly with maxReadFileLine=-1", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue("")
			const maxReadFileLine = -1
			const totalLines = 0
			mockedCountFileLines.mockResolvedValue(totalLines)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			// Empty files should include a content tag and notice
			expect(result).toBe(`<file><path>${testFilePath}</path><content/><notice>File is empty</notice></file>`)
			// And make sure there's no error
			expect(result).not.toContain(`<error>`)
		})

		it("should handle empty files correctly with maxReadFileLine=0", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue("")
			const maxReadFileLine = 0
			const totalLines = 0
			mockedCountFileLines.mockResolvedValue(totalLines)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify
			// Empty files should include a content tag and notice even with maxReadFileLine=0
			expect(result).toBe(`<file><path>${testFilePath}</path><content/><notice>File is empty</notice></file>`)
			// Ensure no line numbers are added
			expect(mockedAddLineNumbers).not.toHaveBeenCalled()
		})

		it("should handle binary files correctly", async () => {
			// Setup
			mockedExtractTextFromFile.mockResolvedValue("Binary content")

			// Execute
			const result = await executeReadFileTool({}, { isBinary: true })

			// Verify
			expect(result).toBe(`<file><path>${testFilePath}</path><content>\nBinary content</content></file>`)
			expect(mockedExtractTextFromFile).toHaveBeenCalledWith(absoluteFilePath)
		})

		it("should handle file read errors correctly", async () => {
			// Setup
			const errorMessage = "File not found"
			mockedExtractTextFromFile.mockRejectedValue(new Error(errorMessage))

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).toContain(
				`<file><path>${testFilePath}</path><error>Error reading file: ${errorMessage}</error></file>`,
			)
			expect(result).not.toContain(`<content`)
		})
	})
})
