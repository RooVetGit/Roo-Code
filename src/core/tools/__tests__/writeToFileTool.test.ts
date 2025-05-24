// npx jest src/core/tools/__tests__/writeToFileTool.test.ts

import * as path from "path"
import delay from "delay"

import { writeToFileTool } from "../writeToFileTool"
import { ToolUse, ToolResponse } from "../../../shared/tools"
import { fileExistsAtPath } from "../../../utils/fs"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { detectCodeOmission } from "../../../integrations/editor/detect-omission"
import { unescapeHtmlEntities } from "../../../utils/text-normalization"
import { addLineNumbers, stripLineNumbers, everyLineHasLineNumbers } from "../../../integrations/misc/extract-text"

// Mock external dependencies
jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

jest.mock("delay")

jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(),
}))

jest.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: jest.fn(),
}))

jest.mock("../../../integrations/editor/detect-omission", () => ({
	detectCodeOmission: jest.fn(),
}))

jest.mock("../../../utils/text-normalization", () => ({
	unescapeHtmlEntities: jest.fn().mockImplementation((text) => text),
}))

jest.mock("../../../integrations/misc/extract-text", () => ({
	addLineNumbers: jest.fn().mockImplementation((content) => content),
	stripLineNumbers: jest.fn().mockImplementation((content) => content),
	everyLineHasLineNumbers: jest.fn().mockReturnValue(false),
}))

jest.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

jest.mock("../../../utils/path", () => ({
	getReadablePath: jest.fn().mockImplementation((cwd, relPath) => relPath),
}))

jest.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn().mockImplementation((msg) => `Error: ${msg}`),
		rooIgnoreError: jest.fn().mockImplementation((path) => `RooIgnore error for ${path}`),
		lineCountTruncationError: jest
			.fn()
			.mockImplementation(
				(actualLines, isNewFile, diffEnabled) =>
					`Line count error: ${actualLines} lines, new file: ${isNewFile}, diff enabled: ${diffEnabled}`,
			),
		createPrettyPatch: jest
			.fn()
			.mockImplementation((path, original, modified) => `Diff for ${path}: ${original} -> ${modified}`),
	},
}))

describe("WriteToFileTool - Newline and Empty Content Scenarios", () => {
	// Mocked functions
	const mockedDelay = delay as jest.MockedFunction<typeof delay>
	const mockedFileExistsAtPath = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockedIsPathOutsideWorkspace = isPathOutsideWorkspace as jest.MockedFunction<typeof isPathOutsideWorkspace>
	const mockedDetectCodeOmission = detectCodeOmission as jest.MockedFunction<typeof detectCodeOmission>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>
	const mockedAddLineNumbers = addLineNumbers as jest.MockedFunction<typeof addLineNumbers>
	const mockedStripLineNumbers = stripLineNumbers as jest.MockedFunction<typeof stripLineNumbers>
	const mockedEveryLineHasLineNumbers = everyLineHasLineNumbers as jest.MockedFunction<typeof everyLineHasLineNumbers>

	// Mock instances
	let mockCline: any
	let mockDiffViewProvider: any
	let askApprovalResult: boolean
	let handleErrorCalled: boolean
	let pushToolResultCalls: ToolResponse[]

	beforeEach(() => {
		jest.clearAllMocks()

		// Reset state
		askApprovalResult = true
		handleErrorCalled = false
		pushToolResultCalls = []

		// Setup path mocks
		mockedPathResolve.mockReturnValue("/test/file.txt")
		mockedIsPathOutsideWorkspace.mockReturnValue(false)
		mockedFileExistsAtPath.mockResolvedValue(false) // Default to new file
		mockedDetectCodeOmission.mockReturnValue(false)
		mockedDelay.mockResolvedValue(undefined)

		// Setup extract-text mocks
		mockedAddLineNumbers.mockImplementation((content) => content)
		mockedStripLineNumbers.mockImplementation((content) => content)
		mockedEveryLineHasLineNumbers.mockReturnValue(false)

		// Setup diff view provider mock
		mockDiffViewProvider = {
			editType: undefined,
			isEditing: false,
			originalContent: "",
			open: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
			reset: jest.fn().mockResolvedValue(undefined),
			revertChanges: jest.fn().mockResolvedValue(undefined),
			saveChanges: jest.fn().mockResolvedValue({
				newProblemsMessage: "",
				userEdits: null,
				finalContent: "",
			}),
			scrollToFirstDiff: jest.fn(),
		}

		// Setup cline mock
		mockCline = {
			cwd: "/test",
			consecutiveMistakeCount: 0,
			didEditFile: false,
			diffStrategy: false,
			diffViewProvider: mockDiffViewProvider,
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
			api: {
				getModel: jest.fn().mockReturnValue({ id: "claude-3-sonnet" }),
			},
			fileContextTracker: {
				trackFileContext: jest.fn().mockResolvedValue(undefined),
			},
			say: jest.fn().mockResolvedValue(undefined),
			ask: jest.fn().mockResolvedValue(true),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			recordToolError: jest.fn(),
		}
	})

	/**
	 * Helper function to execute writeToFileTool with given parameters
	 */
	async function executeWriteToFileTool(
		params: Partial<ToolUse["params"]> = {},
		options: {
			fileExists?: boolean
			partial?: boolean
			approvalResult?: boolean
		} = {},
	): Promise<void> {
		const { fileExists = false, partial = false, approvalResult = true } = options

		// Configure mocks
		mockedFileExistsAtPath.mockResolvedValue(fileExists)
		askApprovalResult = approvalResult

		// Create tool use object
		const toolUse: ToolUse = {
			type: "tool_use",
			name: "write_to_file",
			params: {
				path: "test.txt",
				content: "",
				...params,
			},
			partial,
		}

		// Only add line_count if not explicitly provided in params
		if (!("line_count" in params)) {
			toolUse.params.line_count = "1"
		}

		// Execute the tool
		await writeToFileTool(
			mockCline,
			toolUse,
			async () => askApprovalResult,
			async (_operation: string, _error: any) => {
				handleErrorCalled = true
			},
			(result: ToolResponse) => {
				pushToolResultCalls.push(result)
			},
			(_tagName: string, content?: string) => content ?? "",
		)
	}

	describe("Empty Content Scenarios", () => {
		it("should handle empty string content successfully", async () => {
			await executeWriteToFileTool({
				path: "empty.txt",
				content: "",
				line_count: "1",
			})

			// Verify the tool completed without errors
			expect(handleErrorCalled).toBe(false)
			expect(mockCline.consecutiveMistakeCount).toBe(0)

			// Verify diff view provider was called correctly
			expect(mockDiffViewProvider.open).toHaveBeenCalledWith("empty.txt")
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("", true)
			expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()

			// Verify file tracking
			expect(mockCline.fileContextTracker.trackFileContext).toHaveBeenCalledWith("empty.txt", "roo_edited")

			// Verify success message
			expect(pushToolResultCalls).toHaveLength(1)
			expect(pushToolResultCalls[0]).toContain("successfully saved")
		})

		it("should handle empty content with correct line count calculation", async () => {
			await executeWriteToFileTool({
				path: "empty.txt",
				content: "",
				line_count: "1", // Empty string should be 1 line
			})

			expect(mockCline.consecutiveMistakeCount).toBe(0)
			expect(handleErrorCalled).toBe(false)
		})

		it("should handle empty content in partial mode", async () => {
			await executeWriteToFileTool(
				{
					path: "empty.txt",
					content: "",
					line_count: "1",
				},
				{ partial: true },
			)

			// In partial mode, should update diff view but not save
			expect(mockDiffViewProvider.open).toHaveBeenCalledWith("empty.txt")
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("", false)
			expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		})
	})

	describe("Newline-Only Content Scenarios", () => {
		it("should handle single newline content successfully", async () => {
			await executeWriteToFileTool({
				path: "newline.txt",
				content: "\n",
				line_count: "2", // Single newline creates 2 lines
			})

			expect(handleErrorCalled).toBe(false)
			expect(mockCline.consecutiveMistakeCount).toBe(0)

			// Verify content was passed correctly
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("\n", true)

			// Verify success
			expect(pushToolResultCalls).toHaveLength(1)
			expect(pushToolResultCalls[0]).toContain("successfully saved")
		})

		it("should handle multiple newlines content successfully", async () => {
			const multipleNewlines = "\n\n\n"

			await executeWriteToFileTool({
				path: "multiple-newlines.txt",
				content: multipleNewlines,
				line_count: "4", // Three newlines create 4 lines
			})

			expect(handleErrorCalled).toBe(false)
			expect(mockCline.consecutiveMistakeCount).toBe(0)

			// Verify content was passed correctly
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith(multipleNewlines, true)

			// Verify success
			expect(pushToolResultCalls).toHaveLength(1)
			expect(pushToolResultCalls[0]).toContain("successfully saved")
		})

		it("should handle newline-only content in partial mode", async () => {
			await executeWriteToFileTool(
				{
					path: "newline.txt",
					content: "\n\n",
					line_count: "3",
				},
				{ partial: true },
			)

			// In partial mode, should update diff view but not save
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("\n\n", false)
			expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		})

		it("should handle newlines with line number processing", async () => {
			const newlineContent = "\n\n"

			// Mock that content has line numbers
			mockedEveryLineHasLineNumbers.mockReturnValue(true)
			mockedStripLineNumbers.mockReturnValue("stripped_content")

			await executeWriteToFileTool({
				path: "newline-numbered.txt",
				content: newlineContent,
				line_count: "3",
			})

			// Should strip line numbers when detected
			expect(mockedEveryLineHasLineNumbers).toHaveBeenCalledWith(newlineContent)
			expect(mockedStripLineNumbers).toHaveBeenCalledWith(newlineContent)
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("stripped_content", true)
		})
	})

	describe("Edge Cases with Empty and Newline Content", () => {
		it("should handle empty content when editing existing file", async () => {
			await executeWriteToFileTool(
				{
					path: "existing.txt",
					content: "",
					line_count: "1",
				},
				{ fileExists: true },
			)

			// Should work the same for existing files
			expect(handleErrorCalled).toBe(false)
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("", true)
		})

		it("should handle newline content when editing existing file", async () => {
			mockDiffViewProvider.originalContent = "original content"

			await executeWriteToFileTool(
				{
					path: "existing.txt",
					content: "\n",
					line_count: "2",
				},
				{ fileExists: true },
			)

			expect(handleErrorCalled).toBe(false)
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("\n", true)
		})

		it("should handle code omission detection with empty content", async () => {
			// Mock code omission detection to return true
			mockedDetectCodeOmission.mockReturnValue(true)
			mockCline.diffStrategy = true

			await executeWriteToFileTool({
				path: "empty-with-omission.txt",
				content: "",
				line_count: "1",
			})

			// Should detect omission and revert changes
			expect(mockedDetectCodeOmission).toHaveBeenCalledWith("", "", 1)
			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
			expect(pushToolResultCalls).toHaveLength(1)
			expect(pushToolResultCalls[0]).toContain("Content appears to be truncated")
		})

		it("should handle code omission detection with newline content", async () => {
			mockedDetectCodeOmission.mockReturnValue(true)
			mockCline.diffStrategy = true

			await executeWriteToFileTool({
				path: "newline-with-omission.txt",
				content: "\n\n",
				line_count: "3",
			})

			// Should detect omission and revert changes
			expect(mockedDetectCodeOmission).toHaveBeenCalledWith("", "\n\n", 3)
			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		})

		it("should handle user rejection of empty content", async () => {
			await executeWriteToFileTool(
				{
					path: "rejected-empty.txt",
					content: "",
					line_count: "1",
				},
				{ approvalResult: false },
			)

			// Should revert changes when user rejects
			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
			expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		})

		it("should handle user rejection of newline content", async () => {
			await executeWriteToFileTool(
				{
					path: "rejected-newline.txt",
					content: "\n\n\n",
					line_count: "4",
				},
				{ approvalResult: false },
			)

			// Should revert changes when user rejects
			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
			expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		})
	})

	describe("Line Count Validation with Empty and Newline Content", () => {
		it("should handle missing line_count with empty content", async () => {
			// Create tool use object directly to ensure line_count is undefined
			const toolUse: ToolUse = {
				type: "tool_use",
				name: "write_to_file",
				params: {
					path: "empty-no-count.txt",
					content: "",
					// line_count intentionally omitted
				},
				partial: false,
			}

			// Execute the tool directly
			await writeToFileTool(
				mockCline,
				toolUse,
				async () => true,
				async (_operation: string, _error: any) => {
					handleErrorCalled = true
				},
				(result: ToolResponse) => {
					pushToolResultCalls.push(result)
				},
				(_tagName: string, content?: string) => content ?? "",
			)

			// Should increment mistake count and show error
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("write_to_file")
			expect(pushToolResultCalls).toHaveLength(1)
			expect(pushToolResultCalls[0]).toContain("Line count error")
		})

		it("should handle missing line_count with newline content", async () => {
			// Create tool use object directly to ensure line_count is undefined
			const toolUse: ToolUse = {
				type: "tool_use",
				name: "write_to_file",
				params: {
					path: "newline-no-count.txt",
					content: "\n\n",
					// line_count intentionally omitted
				},
				partial: false,
			}

			// Execute the tool directly
			await writeToFileTool(
				mockCline,
				toolUse,
				async () => true,
				async (_operation: string, _error: any) => {
					handleErrorCalled = true
				},
				(result: ToolResponse) => {
					pushToolResultCalls.push(result)
				},
				(_tagName: string, content?: string) => content ?? "",
			)

			// Should increment mistake count and show error
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("write_to_file")
		})

		it("should handle zero line_count with empty content", async () => {
			await executeWriteToFileTool({
				path: "empty-zero-count.txt",
				content: "",
				line_count: "0",
			})

			// Should treat as missing line count
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("write_to_file")
		})
	})

	describe("Content Preprocessing with Empty and Newline Content", () => {
		it("should handle empty content with markdown code block markers", async () => {
			await executeWriteToFileTool({
				path: "empty-with-markers.txt",
				content: "```\n```",
				line_count: "1",
			})

			// Content should be processed to remove markers, leaving empty string
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("", true)
		})

		it("should handle newline content with markdown code block markers", async () => {
			await executeWriteToFileTool({
				path: "newline-with-markers.txt",
				content: "```\n\n\n```",
				line_count: "3",
			})

			// Content should be processed to remove markers, leaving newlines
			expect(mockDiffViewProvider.update).toHaveBeenCalledWith("\n", true)
		})

		it("should handle HTML entity unescaping with empty content for non-Claude models", async () => {
			// Mock non-Claude model
			mockCline.api.getModel.mockReturnValue({ id: "gpt-4" })

			await executeWriteToFileTool({
				path: "empty-html.txt",
				content: "",
				line_count: "1",
			})

			// Should call unescapeHtmlEntities for non-Claude models
			expect(unescapeHtmlEntities).toHaveBeenCalledWith("")
		})
	})
})
