// npx jest src/core/tools/implementations/__tests__/ReadFileTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { ReadFileTool } from "../ReadFileTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { formatResponse } from "../../../prompts/responses"
import { countFileLines } from "../../../../integrations/misc/line-counter"
import { readLines } from "../../../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import path from "path"

// Mock dependencies
jest.mock("../../../../integrations/misc/line-counter")
jest.mock("../../../../integrations/misc/read-lines")
jest.mock("../../../../integrations/misc/extract-text")
jest.mock("../../../../services/tree-sitter")
jest.mock("isbinaryfile")
jest.mock("../../../prompts/responses")
jest.mock("../../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: jest.fn().mockReturnValue(false),
}))
jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn().mockImplementation((cwd, path) => path),
}))
jest.mock("../../../../i18n", () => ({
	t: jest.fn().mockImplementation((key, params) => {
		if (key === "tools:readFile.linesRange") {
			return `Lines ${params.start} to ${params.end}`
		}
		if (key === "tools:readFile.linesFromToEnd") {
			return `Lines from ${params.start} to end`
		}
		if (key === "tools:readFile.linesFromStartTo") {
			return `Lines from start to ${params.end}`
		}
		if (key === "tools:readFile.definitionsOnly") {
			return "Definitions only"
		}
		if (key === "tools:readFile.maxLines") {
			return `Maximum ${params.max} lines`
		}
		return key
	}),
}))

describe("ReadFileTool", () => {
	// Setup common test variables
	let readFileTool: ReadFileTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
		cwd: string
		providerRef: { deref: jest.Mock }
		rooIgnoreController: { validateAccess: jest.Mock }
	}
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockToolUse: ToolUse

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create mock implementations
		mockCline = {
			consecutiveMistakeCount: 0,
			cwd: "/test",
			say: jest.fn().mockResolvedValue(undefined),
			ask: jest.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			providerRef: {
				deref: jest.fn().mockReturnValue({
					getState: jest.fn().mockResolvedValue({
						maxReadFileLine: 500,
					}),
				}),
			},
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			cwd: string
			providerRef: { deref: jest.Mock }
			rooIgnoreController: { validateAccess: jest.Mock }
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				path: "test.txt",
			},
			partial: false,
		}

		// Mock file-related functions
		;(countFileLines as jest.Mock).mockResolvedValue(10)
		;(readLines as jest.Mock).mockResolvedValue("file content")
		;(addLineNumbers as jest.Mock).mockReturnValue("1 | file content")
		;(extractTextFromFile as jest.Mock).mockResolvedValue("file content")
		;(parseSourceCodeDefinitionsForFile as jest.Mock).mockResolvedValue("source code definitions")
		;(isBinaryFile as jest.Mock).mockResolvedValue(false)

		// Create ReadFileTool instance
		readFileTool = new ReadFileTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(readFileTool.getName()).toBe("read_file")
		})
	})

	describe("execute", () => {
		it("should read a file successfully", async () => {
			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.rooIgnoreController.validateAccess).toHaveBeenCalledWith("test.txt")
			expect(mockAskApproval).toHaveBeenCalled()
			expect(countFileLines).toHaveBeenCalledWith(path.resolve("/test", "test.txt"))
			expect(extractTextFromFile).toHaveBeenCalledWith(path.resolve("/test", "test.txt"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<file><path>test.txt</path>"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining('<content lines="1-10">'))
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing path parameter", async () => {
			// Setup
			mockToolUse.params = {}
			mockCline.sayAndCreateMissingParamError = jest.fn().mockResolvedValue("Missing path parameter")

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("read_file", "path")
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<file><path></path><e>"))
		})

		it("should handle line range parameters", async () => {
			// Setup
			mockToolUse.params = {
				path: "test.txt",
				start_line: "5",
				end_line: "8",
			}

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(readLines).toHaveBeenCalledWith(path.resolve("/test", "test.txt"), 7, 4)
			expect(addLineNumbers).toHaveBeenCalledWith("file content", 5)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining('<content lines="5-8">'))
		})

		it("should handle large files with maxReadFileLine", async () => {
			// Setup
			;(countFileLines as jest.Mock).mockResolvedValue(1000)

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(readLines).toHaveBeenCalledWith(path.resolve("/test", "test.txt"), 499, 0)
			expect(parseSourceCodeDefinitionsForFile).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("<notice>Showing only 500 of 1000 total lines"),
			)
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining(
					"<list_code_definition_names>source code definitions</list_code_definition_names>",
				),
			)
		})

		it("should handle empty files", async () => {
			// Setup
			;(countFileLines as jest.Mock).mockResolvedValue(0)
			;(extractTextFromFile as jest.Mock).mockResolvedValue("")

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<content/>"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("<notice>File is empty</notice>"))
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			;(extractTextFromFile as jest.Mock).mockRejectedValue(error)

			// Execute
			await readFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("reading file", error)
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("<e>Error reading file: Test error</e>"),
			)
		})
	})
})
