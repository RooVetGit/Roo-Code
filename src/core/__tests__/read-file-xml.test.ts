// npx jest src/core/__tests__/read-file-xml.test.ts

import * as path from "path"

import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse, ToolUse } from "../../shared/tools" // Import ToolUse
import { mocked } from "jest-mock" // Import mocked
import { RooIgnoreController } from "../ignore/RooIgnoreController" // Correct Import Path

// Mock dependencies
jest.mock("../../integrations/misc/line-counter")
jest.mock("../../integrations/misc/read-lines")
jest.mock("../../integrations/misc/extract-text", () => {
	const actual = jest.requireActual("../../integrations/misc/extract-text")
	const addLineNumbersSpy = jest.spyOn(actual, "addLineNumbers")

	return {
		...actual,
		__addLineNumbersSpy: addLineNumbersSpy,
		// Mock extractTextFromFile to return raw content; addLineNumbers is called separately in the tool
		extractTextFromFile: jest.fn().mockImplementation((filePath) => {
			// Return the raw content based on the path (or use a map if needed for multiple files)
			const content = mockFileContents[filePath] ?? mockFileContents["default"] ?? ""
			return Promise.resolve(content)
		}),
		// Keep the spy on the actual addLineNumbers
		addLineNumbers: actual.addLineNumbers,
	}
})

// Get a reference to the spy
const addLineNumbersSpy = jest.requireMock("../../integrations/misc/extract-text").__addLineNumbersSpy

// Store mock content per file path
let mockFileContents: Record<string, string> = {}
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
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5\n"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

	// Mocked functions with correct types
	const mockedCountFileLines = countFileLines as jest.MockedFunction<typeof countFileLines>
	const mockedReadLines = readLines as jest.MockedFunction<typeof readLines>
	const mockedExtractTextFromFile = extractTextFromFile as jest.MockedFunction<typeof extractTextFromFile>
	const mockedParseSourceCodeDefinitionsForFile = parseSourceCodeDefinitionsForFile as jest.MockedFunction<
		typeof parseSourceCodeDefinitionsForFile
	>
	const mockedIsBinaryFile = isBinaryFile as jest.MockedFunction<typeof isBinaryFile>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>

	// Mock instances
	const mockCline: any = {}
	let mockProvider: any
	let toolResult: string | undefined
	// Declare mocks accessible to all tests within this describe block
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockGetState: jest.Mock
	let mockRooIgnoreController: jest.Mocked<RooIgnoreController>

	beforeEach(() => {
		jest.clearAllMocks()

		// Define mocks in beforeEach
		mockAskApproval = jest.fn().mockResolvedValue(true) // Default to approved
		mockHandleError = jest.fn()
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn((tag, value) => value) // Simple pass-through

		mockGetState = jest.fn().mockResolvedValue({
			maxReadFileLine: 500,
			maxConcurrentFileReads: 5, // Add default for tests
			alwaysAllowReadOnly: false,
			alwaysAllowReadOnlyOutsideWorkspace: false,
		})

		// Setup mock provider with more settings
		mockProvider = {
			getState: mockGetState, // Use the mock function
			deref: jest.fn().mockReturnThis(), // Keep deref simple for tests
		}

		mockRooIgnoreController = new RooIgnoreController(
			"/workspace",
		) as jest.Mocked<RooIgnoreController> // Cast correctly
		mocked(mockRooIgnoreController.validateAccess).mockReturnValue(true) // Use mocked

		// Setup Cline instance with mock methods
		mockCline.cwd = "/workspace" // Use a more realistic CWD
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: jest.fn().mockReturnValue(true),
		}
		mockCline.say = jest.fn().mockResolvedValue(undefined)
		mockCline.ask = jest.fn().mockResolvedValue(true)
		mockCline.presentAssistantMessage = jest.fn()
		mockCline.sayAndCreateMissingParamError = jest.fn().mockResolvedValue("Missing required parameter")
		// Add mock for getFileContextTracker method
		mockCline.getFileContextTracker = jest.fn().mockReturnValue({
			trackFileContext: jest.fn().mockResolvedValue(undefined),
		})
		mockCline.recordToolUsage = jest.fn().mockReturnValue(undefined)
		mockCline.recordToolError = jest.fn().mockReturnValue(undefined)

		// Reset tool result
		toolResult = undefined
	})

	// Define options type
	interface ExecuteReadFileToolOptions {
		totalLines?: number | Record<string, number> // Allow object for per-file lines
		maxReadFileLine?: number
		isBinary?: boolean
		validateAccess?: boolean
		skipAddLineNumbersCheck?: boolean
		maxConcurrentFileReads?: number // Add new options
		alwaysAllowReadOnly?: boolean
		alwaysAllowReadOnlyOutsideWorkspace?: boolean
	}

	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: ExecuteReadFileToolOptions = {}, // Use the defined interface
	): Promise<string | undefined> {
		// Configure mocks based on test scenario
		const totalLinesOption = options.totalLines ?? 5
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const isBinary = options.isBinary ?? false
		const validateAccess = options.validateAccess ?? true

		mockProvider.getState.mockResolvedValue({
			maxReadFileLine,
			maxConcurrentFileReads: options.maxConcurrentFileReads ?? 5, // Use option value
			alwaysAllowReadOnly: options.alwaysAllowReadOnly ?? false, // Use option value
			alwaysAllowReadOnlyOutsideWorkspace: options.alwaysAllowReadOnlyOutsideWorkspace ?? false, // Use option value
		})

		// Allow mocking countFileLines per file if needed
		if (typeof totalLinesOption === "number") {
			mockedCountFileLines.mockResolvedValue(totalLinesOption)
		} else if (typeof totalLinesOption === "object" && totalLinesOption !== null) {
			mockedCountFileLines.mockImplementation(async (p: string): Promise<number> => {
				// Explicitly type totalLinesOption as Record<string, number> for safe access
				const linesMap = totalLinesOption as Record<string, number>
				return p in linesMap ? linesMap[p] : 5 // Default to 5 if key not found
			})
		} else {
			mockedCountFileLines.mockResolvedValue(5) // Default if not specified or null
		}

		mockedIsBinaryFile.mockResolvedValue(isBinary)
		mockCline.rooIgnoreController.validateAccess = jest.fn().mockReturnValue(validateAccess)

		// Create a tool use object using the correct ToolUse type
		const toolUse: ToolUse = { // Use ToolUse type
			type: "tool_use", // Add missing property
			name: "read_file", // Correct property name is 'name'
			// tool_id is not part of ToolUse request type
			params: {
				path: testFilePath, // Default single path
				...params,
			},
			partial: false, // Add missing property
		}

		// Import the tool implementation dynamically to avoid hoisting issues
		const { readFileTool } = require("../readFileTool") // Corrected path

		// Reset the spy's call history before each test
		addLineNumbersSpy.mockClear()

		// Execute the tool
		await readFileTool(
			mockCline,
			toolUse, // Pass the correctly typed object
			mockAskApproval, // Use the mock defined in the outer scope
			mockHandleError, // Use the mock defined in the outer scope
			(result: string) => {
				toolResult = result
			}, // pushToolResult mock
			mockRemoveClosingTag, // Use the mock defined in the outer scope
		)

		// Verify addLineNumbers was called appropriately
		// Determine effective total lines for the check
		let effectiveTotalLines = 5 // Default
		if (typeof totalLinesOption === "number") {
			effectiveTotalLines = totalLinesOption
		} else if (typeof totalLinesOption === "object" && totalLinesOption !== null) {
			// If it's an object, we can't easily determine a single value for this check,
			// maybe assume > 0 if the object is not empty? Or skip the check?
			// For simplicity, let's assume > 0 if it's an object.
			effectiveTotalLines = Object.keys(totalLinesOption).length > 0 ? 1 : 0
		}

		const shouldCallAddLineNumbers =
			!isBinary &&
			effectiveTotalLines > 0 &&
			(maxReadFileLine !== 0 || params.start_line || params.end_line) &&
			!options.skipAddLineNumbersCheck

		if (shouldCallAddLineNumbers) {
			expect(addLineNumbersSpy).toHaveBeenCalled()
		} else {
			expect(addLineNumbersSpy).not.toHaveBeenCalled()
		}

		return toolResult
	}

	// --- Existing tests remain below, potentially needing adjustments ---

	describe("Basic XML Structure Tests (Single File)", () => {
		beforeEach(() => {
			// Set default content for single file tests
			mockFileContents = { default: fileContent }
		})

		it("should produce XML output for a single file", async () => {
			// Execute
			const result = await executeReadFileTool({ path: testFilePath }) // Explicitly pass single path

			// Verify - Expect <read_result> wrapper now
			// Use the actual addLineNumbers function for expected output
			const { addLineNumbers: actualAddLineNumbers } = jest.requireActual("../../integrations/misc/extract-text")
			const expectedNumberedContent = actualAddLineNumbers(fileContent)
			expect(result).toBe(
				`<read_result>\n<file_content path="${testFilePath}">\n<content lines="1-5">\n${expectedNumberedContent}\n</content>\n</file_content>\n</read_result>`,
			)
		})

		// This test might be less relevant now with the wrapper, but keep for basic structure check
		it("should follow the correct XML structure format for single file", async () => {
			// Execute
			const result = await executeReadFileTool({ path: testFilePath })

			// Verify using regex to check structure within the wrapper
			const xmlStructureRegex = new RegExp(
				`^<read_result>\\n<file_content path="${testFilePath}">\\n<content lines="1-5">\\n.*\\n</content>\\n</file_content>\\n</read_result>$`,
				"s",
			)
			expect(result).toMatch(xmlStructureRegex)
		})
	})

	describe("Line Range Tests (Single File)", () => {
		beforeEach(() => {
			mockFileContents = { default: fileContent }
		})
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

			// Verify - Check within the <read_result>
			expect(result).toContain(`<content lines="${startLine}-5">`)
		})

		it("should include lines attribute when end_line is specified (single file)", async () => {
			// Setup
			const endLine = 3
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, endLine).join("\n"))

			// Execute
			const result = await executeReadFileTool({ path: testFilePath, end_line: endLine.toString() })

			// Verify - Check within the <read_result>
			expect(result).toContain(`<content lines="1-${endLine}">`)
		})

		it("should include lines attribute when both start_line and end_line are specified (single file)", async () => {
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
				path: testFilePath,
				start_line: startLine.toString(),
				end_line: endLine.toString(),
			})

			// Verify - Check within the <read_result>
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)
		})

		it("should include lines attribute even when no range is specified (single file)", async () => {
			// Execute
			const result = await executeReadFileTool({ path: testFilePath })

			// Verify - Check within the <read_result>
			expect(result).toContain(`<content lines="1-5">`) // Note: Removed extra \n here
		})

		it("should include content when maxReadFileLine=0 and range is specified (single file)", async () => {
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
			// Should include content tag with line range within <read_result>
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only start_line is specified (single file)", async () => {
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
			// Should include content tag with line range within <read_result>
			expect(result).toContain(`<content lines="${startLine}-${totalLines}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only end_line is specified (single file)", async () => {
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
			// Should include content tag with line range within <read_result>
			expect(result).toContain(`<content lines="1-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include full range content when maxReadFileLine=5 and content has more than 5 lines (single file)", async () => {
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
			// Should include content tag with the full requested range within <read_result>
			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)

			// Should NOT include definitions (range reads never show definitions)
			expect(result).not.toContain("<list_code_definition_names>")

			// Should NOT include truncation notice
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)

			// Should contain all the requested lines, not just maxReadFileLine lines
			expect(result).toBeDefined()
			if (result) {
				// Adjust check for the wrapper structure
				const contentTagMatch = result.match(/<content[^>]*>([\s\S]*)<\/content>/)
				expect(contentTagMatch).toBeTruthy()
				expect(contentTagMatch![1].trim().split("\n").length).toBeGreaterThan(maxReadFileLine)
			}
		})
	})

	describe("Notice and Definition Tags Tests (Single File)", () => {
		beforeEach(() => {
			mockFileContents = { default: fileContent }
		})

		it("should include notice tag for truncated files (single file)", async () => {
			// Setup
			const maxReadFileLine = 3
			const totalLines = 10
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, maxReadFileLine).join("\n"))

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify - Check within <read_result>
			expect(result).toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include list_code_definition_names tag when source code definitions are available (single file)", async () => {
			// Setup
			const maxReadFileLine = 3
			const totalLines = 10
			mockedReadLines.mockResolvedValue(fileContent.split("\n").slice(0, maxReadFileLine).join("\n"))
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine, totalLines })

			// Verify - Check within <read_result>
			// Use regex to match the tag content regardless of whitespace
			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
		})

		it("should only have definitions, no content when maxReadFileLine=0 (single file)", async () => {
			// Setup
			const maxReadFileLine = 0
			const totalLines = 10
			// Mock content with exactly 10 lines to match totalLines
			const rawContent = Array(10).fill("Line content").join("\n")
			mockFileContents = { default: rawContent } // Use the map
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute - skip addLineNumbers check as it's not called for maxReadFileLine=0
			const result = await executeReadFileTool(
				{ path: testFilePath }, // Specify path for single file test
				{ maxReadFileLine, totalLines, skipAddLineNumbersCheck: true },
			)

			// Verify - Check within <read_result>
			expect(result).toContain(`<notice>Showing only 0 of ${totalLines} total lines`)
			// Use regex to match the tag content regardless of whitespace
			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
			expect(result).not.toContain(`<content`) // No <content> tag
		})

		it("should handle maxReadFileLine=0 with no source code definitions (single file)", async () => {
			// Setup
			const maxReadFileLine = 0
			const totalLines = 10
			// Mock that no source code definitions are available
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue("")
			// Mock content with exactly 10 lines to match totalLines
			const rawContent = Array(10).fill("Line content").join("\n")
			mockFileContents = { default: rawContent } // Use the map
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue("") // No definitions

			// Execute - skip addLineNumbers check as it's not called for maxReadFileLine=0
			const result = await executeReadFileTool(
				{ path: testFilePath }, // Specify path for single file test
				{ maxReadFileLine, totalLines, skipAddLineNumbersCheck: true },
			)

			// Verify - Check within <read_result>
			// Should include notice within file_content
			expect(result).toContain(
				`<file_content path="${testFilePath}">\n<notice>Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n</file_content>`,
			)
			// Should not include list_code_definition_names tag since there are no definitions
			expect(result).not.toContain("<list_code_definition_names>")
			// Should not include content tag for non-empty files with maxReadFileLine=0
			expect(result).not.toContain("<content") // No <content> tag
		})
	})

	describe("Error Handling Tests (Single File)", () => {
		beforeEach(() => {
			mockFileContents = { default: fileContent }
		})

		it("should return tool_error for missing path parameter", async () => {
			// Setup - missing path parameter
			// Setup - missing path parameter
			// Setup - missing path parameter
			const toolUse: ToolUse = { // Use correct type
				type: "tool_use", // Add missing property
				name: "read_file", // Correct property name
				// tool_id is not part of ToolUse request type
				params: {}, // No path
				partial: false, // Add missing property
			}

			// Import the tool implementation dynamically
			const { readFileTool } = require("../readFileTool") // Corrected path

			// Execute the tool
			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				jest.fn(), // handleError
				(result: string) => {
					toolResult = result
				}, // pushToolResult
				(param: string, value: string) => value, // removeClosingTag
			)

			// Verify - Should now be a tool_error
			expect(toolResult).toBe(`<tool_error tool_name="read_file">Missing param</tool_error>`)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("read_file", "path")
		})

		it("should return tool_error for invalid start_line", async () => {
			// Execute - skip addLineNumbers check as it returns early with an error
			const result = await executeReadFileTool({ path: testFilePath, start_line: "invalid" }, { skipAddLineNumbersCheck: true })

			// Verify - Should now be a tool_error
			expect(result).toBe(
				'<tool_error tool_name="read_file">tools:readFile.error.invalidStartLine{"value":"invalid"}</tool_error>',
			)
		})

		it("should return tool_error for invalid end_line", async () => {
			// Execute - skip addLineNumbers check as it returns early with an error
			const result = await executeReadFileTool({ path: testFilePath, end_line: "invalid" }, { skipAddLineNumbersCheck: true })

			// Verify - Should now be a tool_error
			expect(result).toBe(
				'<tool_error tool_name="read_file">tools:readFile.error.invalidEndLine{"value":"invalid"}</tool_error>',
			)
		})

		it("should return file_error within read_result for RooIgnore error (single file)", async () => {
			// Execute - skip addLineNumbers check as it returns early with an error
			const result = await executeReadFileTool(
				{ path: testFilePath },
				{ validateAccess: false, skipAddLineNumbersCheck: true },
			)

			// Verify - Error is now per-file within the result wrapper
			expect(result).toContain(`<read_result>`)
			expect(result).toContain(`<file_error path="${testFilePath}" reason="common:errors.rooIgnoreError`)
			expect(result).toContain(`</read_result>`)
			expect(result).not.toContain(`<file_content`)
		})
	})

	describe("Edge Cases Tests (Single File)", () => {
		beforeEach(() => {
			mockFileContents = { default: "" } // Default to empty for edge cases
		})
		it("should handle empty files correctly with maxReadFileLine=-1 (single file)", async () => {
			// Setup - use empty string
			// Setup - use empty string via mockFileContents
			const maxReadFileLine = -1
			const totalLines = 0
			// No need to mock countFileLines again if beforeEach sets it

			// Execute
			const result = await executeReadFileTool({ path: testFilePath }, { maxReadFileLine, totalLines })

			// Verify - Check within <read_result>
			// Empty files should include a content tag and notice
			expect(result).toBe(
				`<read_result>\n<file_content path="${testFilePath}">\n<content/><notice>File is empty</notice>\n</file_content>\n</read_result>`,
			)
		})

		it("should handle empty files correctly with maxReadFileLine=0 (single file)", async () => {
			// Setup - use empty string
			// Setup - use empty string via mockFileContents
			const maxReadFileLine = 0
			const totalLines = 0
			// No need to mock countFileLines again if beforeEach sets it

			// Execute
			const result = await executeReadFileTool({ path: testFilePath }, { maxReadFileLine, totalLines })

			// Verify - Check within <read_result>
			// Empty files should include a content tag and notice even with maxReadFileLine=0
			expect(result).toBe(
				`<read_result>\n<file_content path="${testFilePath}">\n<content/><notice>File is empty</notice>\n</file_content>\n</read_result>`,
			)
		})

		it("should handle binary files correctly (single file)", async () => {
			// Setup
			const binaryContent = "Binary content"
			mockFileContents = { [absoluteFilePath]: binaryContent } // Use absolute path for mock lookup
			mockedCountFileLines.mockResolvedValue(5) // Assume some lines for binary

			// Execute - skip addLineNumbers check as binary files don't use it
			const result = await executeReadFileTool(
				{ path: testFilePath },
				{ isBinary: true, totalLines: 5, skipAddLineNumbersCheck: true },
			)

			// Verify - Check within <read_result>
			expect(result).toBe(
				`<read_result>\n<file_content path="${testFilePath}">\n<content lines="1-5">\n${binaryContent}\n</content>\n</file_content>\n</read_result>`,
			)
			expect(mockedExtractTextFromFile).toHaveBeenCalledWith(absoluteFilePath)
		})

		it("should return file_error within read_result for file read errors (single file)", async () => {
			// Setup
			const errorMessage = "Disk read error"
			// Mock counting lines to fail
			mockedCountFileLines.mockRejectedValue(new Error(errorMessage))

			// Execute - skip addLineNumbers check as it throws an error
			const result = await executeReadFileTool({ path: testFilePath }, { skipAddLineNumbersCheck: true })

			// Verify - Error is now per-file within the result wrapper
			expect(result).toContain(`<read_result>`)
			expect(result).toContain(
				`<file_error path="${testFilePath}" reason="tools:readFile.error.countingLines{`, // Check for key part
			)
			expect(result).toContain(`</read_result>`)
			expect(result).not.toContain(`<file_content`)
		})
	})

	// --- NEW Multi-File Tests ---
	describe("Multi-File Tests", () => {
		const file1Path = "file1.txt"
		const file2Path = "subdir/file2.js"
		const file3Path = "another.css"
		const absFile1Path = `/workspace/${file1Path}`
		const absFile2Path = `/workspace/${file2Path}`
		const absFile3Path = `/workspace/${file3Path}`

		const file1Content = "Content of file1"
		const file2Content = "console.log('file2');\nfunction hello() {}"
		const file3Content = ".class { color: red; }"

		beforeEach(() => {
			mockFileContents = {
				[absFile1Path]: file1Content,
				[absFile2Path]: file2Content,
				[absFile3Path]: file3Content,
			}
			// Mock path resolve correctly for multiple paths
			mockedPathResolve.mockImplementation((cwd, relPath) => path.join(cwd, relPath)) // Use actual join
		})

		it("should read multiple files specified in a JSON array", async () => {
			const paths = [file1Path, file2Path]
			const jsonPath = JSON.stringify(paths)

			// Mock line counts
			const totalLines = {
				[absFile1Path]: 1,
				[absFile2Path]: 2,
			}

			// Execute
			const result = await executeReadFileTool({ path: jsonPath }, { totalLines }) // Pass the object directly

			// Verify
			expect(mockAskApproval).toHaveBeenCalledTimes(1) // Approval asked once for the batch
			expect(result).toContain("<read_result>")
			// File 1
			expect(result).toContain(`<file_content path="${file1Path}">`)
			expect(result).toContain(`<content lines="1-1">`)
			// Use actual addLineNumbers for verification
			const { addLineNumbers: actualAddLineNumbers } = jest.requireActual("../../integrations/misc/extract-text")
			expect(result).toContain(actualAddLineNumbers(file1Content, 1))
			// File 2
			expect(result).toContain(`<file_content path="${file2Path}">`)
			expect(result).toContain(`<content lines="1-2">`)
			expect(result).toContain(actualAddLineNumbers(file2Content, 1))
			expect(result).toContain("</read_result>")
			// Check addLineNumbers was called for both
			expect(addLineNumbersSpy).toHaveBeenCalledTimes(2)
		})

		it("should return tool_error if number of files exceeds maxConcurrentFileReads", async () => {
			const paths = [file1Path, file2Path, file3Path]
			const jsonPath = JSON.stringify(paths)
			const maxConcurrentFileReads = 2

			// Execute
			const result = await executeReadFileTool({ path: jsonPath }, { maxConcurrentFileReads }) // Pass option correctly

			// Verify
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(result).toBe(
				`<tool_error tool_name="read_file">tools:readFile.error.tooManyFiles{"count":3,"max":2}</tool_error>`,
			)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("read_file")
		})

		it("should handle individual file errors (not found) within a batch", async () => {
			const notFoundPath = "nonexistent.txt"
			const absNotFoundPath = `/workspace/${notFoundPath}`
			const paths = [file1Path, notFoundPath, file2Path]
			const jsonPath = JSON.stringify(paths)

			// Mock line counts, making one fail
			const totalLines = {
				[absFile1Path]: 1,
				[absFile2Path]: 2,
			}
			mockedCountFileLines.mockImplementation(async (p) => {
				if (p === absNotFoundPath) {
					throw { code: "ENOENT" } // Simulate file not found error
				}
				// Safer access
				// Explicitly type totalLines as Record<string, number> for safe access
				const linesMap = totalLines as Record<string, number>
				return p in linesMap ? linesMap[p] : 0 // Default to 0 if key not found
			})

			// Execute
			const result = await executeReadFileTool({ path: jsonPath }, { totalLines }) // Pass the object directly

			// Verify
			expect(mockAskApproval).toHaveBeenCalledTimes(1)
			expect(result).toContain("<read_result>")
			// File 1 (Success)
			expect(result).toContain(`<file_content path="${file1Path}">`)
			// File 2 (Error)
			expect(result).toContain(
				`<file_error path="${notFoundPath}" reason="tools:readFile.error.fileNotFound{`,
			)
			// File 3 (Success)
			expect(result).toContain(`<file_content path="${file2Path}">`)
			expect(result).toContain("</read_result>")
			// addLineNumbers only called for successful reads
			expect(addLineNumbersSpy).toHaveBeenCalledTimes(2)
		})

		it("should handle individual file errors (rooignore) within a batch", async () => {
			const ignoredPath = "ignored.cfg"
			const absIgnoredPath = `/workspace/${ignoredPath}`
			const paths = [file1Path, ignoredPath, file2Path]
			const jsonPath = JSON.stringify(paths)

			// Mock rooignore validation
			mockCline.rooIgnoreController.validateAccess.mockImplementation((p: string) => p !== ignoredPath)

			// Mock line counts
			const totalLines = {
				[absFile1Path]: 1,
				[absFile2Path]: 2,
				[absIgnoredPath]: 10, // Ignored file might still have lines counted before check
			}

			// Execute
			const result = await executeReadFileTool({ path: jsonPath }, { totalLines }) // Pass the object directly

			// Verify
			expect(mockAskApproval).toHaveBeenCalledTimes(1) // Approval still asked for allowed files
			expect(result).toContain("<read_result>")
			// File 1 (Success)
			expect(result).toContain(`<file_content path="${file1Path}">`)
			// File 2 (Error)
			expect(result).toContain(`<file_error path="${ignoredPath}" reason="common:errors.rooIgnoreError`)
			// File 3 (Success)
			expect(result).toContain(`<file_content path="${file2Path}">`)
			expect(result).toContain("</read_result>")
			// addLineNumbers only called for successful reads
			expect(addLineNumbersSpy).toHaveBeenCalledTimes(2)
			expect(mockCline.say).toHaveBeenCalledWith("rooignore_error", ignoredPath)
		})

		it("should treat invalid JSON path as a single (likely invalid) path", async () => {
			const invalidJsonPath = '["file1.txt", file2.js]' // Missing quotes
			const absInvalidPath = `/workspace/${invalidJsonPath}` // Path resolve will treat it literally

			// Mock count lines to fail for the literal invalid path
			mockedCountFileLines.mockImplementation(async (p) => {
				if (p === absInvalidPath) {
					throw { code: "ENOENT" }
				}
				return 0
			})

			// Execute
			const result = await executeReadFileTool({ path: invalidJsonPath })

			// Verify it tried to read the literal string as a path
			expect(mockAskApproval).toHaveBeenCalledTimes(1) // Approval asked for the single path attempt
			expect(result).toContain("<read_result>")
			expect(result).toContain(
				`<file_error path="${invalidJsonPath}" reason="tools:readFile.error.fileNotFound{`,
			)
			expect(result).toContain("</read_result>")
			expect(addLineNumbersSpy).not.toHaveBeenCalled()
		})

		it("should return tool_error for empty path array '[]'", async () => {
			const result = await executeReadFileTool({ path: "[]" })
			expect(result).toBe('<tool_error tool_name="read_file">tools:readFile.error.noValidPaths</tool_error>')
			expect(mockAskApproval).not.toHaveBeenCalled()
		})

		it("should ask for approval once if any file requires it (multi-file)", async () => {
			const outsidePath = "../outside/file.txt" // Relative path outside workspace
			const absOutsidePath = path.resolve("/workspace", outsidePath) // Resolve correctly
			const paths = [file1Path, outsidePath]
			const jsonPath = JSON.stringify(paths)

			// Mock path resolution and outside check
			mockedPathResolve.mockImplementation((cwd, relPath) => path.resolve(cwd, relPath)) // Use actual resolve
			const { isPathOutsideWorkspace: actualIsOutside } = jest.requireActual("../../utils/pathUtils")
			const mockedIsPathOutsideWorkspace = require("../../utils/pathUtils")
				.isPathOutsideWorkspace as jest.Mock
			mockedIsPathOutsideWorkspace.mockImplementation((p) => actualIsOutside(p, "/workspace")) // Check relative to workspace

			// Mock state for approval check
			mockProvider.getState.mockResolvedValue({
				maxReadFileLine: 500,
				maxConcurrentFileReads: 5,
				alwaysAllowReadOnly: true, // Auto-approve inside
				alwaysAllowReadOnlyOutsideWorkspace: false, // Require approval outside
			})

			// Mock file contents and line counts
			mockFileContents = {
				[absFile1Path]: file1Content,
				[absOutsidePath]: "Outside content",
			}
			const totalLines = {
				[absFile1Path]: 1,
				[absOutsidePath]: 1,
			}

			// Execute
			const result = await executeReadFileTool({ path: jsonPath }, { totalLines }) // Pass the object directly

			// Verify approval was asked ONCE
			expect(mockAskApproval).toHaveBeenCalledTimes(1)
			// Verify the approval message indicated the outside file or multiple files
			expect(mockAskApproval).toHaveBeenCalledWith(
				"tool",
				expect.stringContaining(JSON.stringify(outsidePath)), // Check if the specific path needing approval is mentioned
			)

			// Verify both files were read successfully after approval
			expect(result).toContain("<read_result>")
			expect(result).toContain(`<file_content path="${file1Path}">`)
			expect(result).toContain(`<file_content path="${outsidePath}">`)
			expect(result).toContain("</read_result>")
			expect(addLineNumbersSpy).toHaveBeenCalledTimes(2)
		})
	})
})
