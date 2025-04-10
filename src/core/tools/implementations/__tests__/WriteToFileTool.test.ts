// npx jest src/core/tools/implementations/__tests__/WriteToFileTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { WriteToFileTool } from "../WriteToFileTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { formatResponse } from "../../../prompts/responses"
import path from "path"
import { fileExistsAtPath } from "../../../../utils/fs"
import { everyLineHasLineNumbers, stripLineNumbers, addLineNumbers } from "../../../../integrations/misc/extract-text"
import { detectCodeOmission } from "../../../../integrations/editor/detect-omission"

// Mock dependencies
jest.mock("../../../../utils/fs")
jest.mock("../../../../integrations/misc/extract-text")
jest.mock("../../../../integrations/editor/detect-omission")
jest.mock("../../../prompts/responses")
jest.mock("delay", () => jest.fn().mockResolvedValue(undefined))
jest.mock("../../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: jest.fn().mockReturnValue(false),
}))
jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn().mockImplementation((cwd, path) => path),
}))

describe("WriteToFileTool", () => {
	// Setup common test variables
	let writeToFileTool: WriteToFileTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
		cwd: string
		didEditFile: boolean
		api: { getModel: jest.Mock }
		diffViewProvider: any
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
			didEditFile: false,
			cwd: "/test",
			say: jest.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			ask: jest.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			api: {
				getModel: jest.fn().mockReturnValue({
					id: "claude-3-5-sonnet-20241022",
				}),
			},
			diffViewProvider: {
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
					finalContent: "final content",
				}),
			},
			providerRef: {
				deref: jest.fn().mockReturnValue({
					getState: jest.fn().mockResolvedValue({}),
				}),
			},
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
			diffStrategy: {
				// Mock properties as needed
			},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			cwd: string
			didEditFile: boolean
			api: { getModel: jest.Mock }
			diffViewProvider: any
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
			name: "write_to_file",
			params: {
				path: "test.txt",
				content: "file content",
				line_count: "5",
			},
			partial: false,
		}

		// Mock file-related functions
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)
		;(everyLineHasLineNumbers as jest.Mock).mockReturnValue(false)
		;(stripLineNumbers as jest.Mock).mockReturnValue("file content")
		;(addLineNumbers as jest.Mock).mockReturnValue("1 | file content")
		;(detectCodeOmission as jest.Mock).mockReturnValue(false)
		;(formatResponse.createPrettyPatch as jest.Mock).mockReturnValue("diff content")

		// Create WriteToFileTool instance
		writeToFileTool = new WriteToFileTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(writeToFileTool.getName()).toBe("write_to_file")
		})
	})

	describe("execute", () => {
		it("should create a new file successfully", async () => {
			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.rooIgnoreController.validateAccess).toHaveBeenCalledWith("test.txt")
			expect(fileExistsAtPath).toHaveBeenCalledWith(path.resolve("/test", "test.txt"))
			expect(mockCline.diffViewProvider.open).toHaveBeenCalledWith("test.txt")
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("file content", false)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockCline.diffViewProvider.saveChanges).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith("The content was successfully saved to test.txt.")
			expect(mockCline.didEditFile).toBe(true)
		})

		it("should modify an existing file successfully", async () => {
			// Setup
			;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
			mockCline.diffViewProvider.originalContent = "original content"

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.diffViewProvider.editType).toBe("modify")
			expect(formatResponse.createPrettyPatch).toHaveBeenCalledWith(
				"test.txt",
				"original content",
				"file content",
			)
			expect(mockPushToolResult).toHaveBeenCalledWith("The content was successfully saved to test.txt.")
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalled()
			expect(mockCline.diffViewProvider.open).toHaveBeenCalledWith("test.txt")
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("file content", false)
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing parameters", async () => {
			// Setup
			mockToolUse.params = { path: "test.txt" } // missing content and line_count

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockPushToolResult).not.toHaveBeenCalled() // Tool should return early without calling pushToolResult
		})

		it("should handle code omissions", async () => {
			// Setup
			;(detectCodeOmission as jest.Mock).mockReturnValue(true)
			;(formatResponse.toolError as jest.Mock).mockReturnValue("Code omission error")

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(detectCodeOmission).toHaveBeenCalled()
			expect(mockCline.diffViewProvider.revertChanges).toHaveBeenCalled()
			expect(formatResponse.toolError).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith("Code omission error")
		})

		it("should handle user edits", async () => {
			// Setup
			mockCline.diffViewProvider.saveChanges.mockResolvedValue({
				newProblemsMessage: "",
				userEdits: "user edits",
				finalContent: "final content",
			})

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.say).toHaveBeenCalledWith("user_feedback_diff", expect.any(String))
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("The user made the following updates to your content"),
			)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("user edits"))
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			mockCline.diffViewProvider.open.mockRejectedValue(error)

			// Execute
			await writeToFileTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("writing file", error)
			expect(mockCline.diffViewProvider.reset).toHaveBeenCalled()
		})
	})
})
