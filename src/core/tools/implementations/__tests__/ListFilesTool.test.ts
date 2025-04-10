// npx jest src/core/tools/implementations/__tests__/ListFilesTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { ListFilesTool } from "../ListFilesTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { formatResponse } from "../../../prompts/responses"
import { listFiles } from "../../../../services/glob/list-files"
import path from "path"

// Mock dependencies
jest.mock("../../../../services/glob/list-files")
jest.mock("../../../prompts/responses")
jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn().mockImplementation((cwd, path) => path),
}))

describe("ListFilesTool", () => {
	// Setup common test variables
	let listFilesTool: ListFilesTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
		cwd: string
		providerRef: { deref: jest.Mock }
		rooIgnoreController: any
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
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			ask: jest.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			providerRef: {
				deref: jest.fn().mockReturnValue({
					getState: jest.fn().mockResolvedValue({
						showRooIgnoredFiles: true,
					}),
				}),
			},
			rooIgnoreController: {},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			cwd: string
			providerRef: { deref: jest.Mock }
			rooIgnoreController: any
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "list_files",
			params: {
				path: "src",
				recursive: "false",
			},
			partial: false,
		}

		// Mock listFiles function
		;(listFiles as jest.Mock).mockResolvedValue([["file1.ts", "file2.ts"], false])
		;(formatResponse.formatFilesList as jest.Mock).mockReturnValue("file1.ts\nfile2.ts")

		// Create ListFilesTool instance
		listFilesTool = new ListFilesTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(listFilesTool.getName()).toBe("list_files")
		})
	})

	describe("execute", () => {
		it("should list files successfully", async () => {
			// Execute
			await listFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(listFiles).toHaveBeenCalledWith(path.resolve("/test", "src"), false, 200)
			expect(formatResponse.formatFilesList).toHaveBeenCalledWith(
				path.resolve("/test", "src"),
				["file1.ts", "file2.ts"],
				false,
				mockCline.rooIgnoreController,
				true,
			)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith("file1.ts\nfile2.ts")
		})

		it("should handle recursive listing", async () => {
			// Setup
			mockToolUse.params.recursive = "true"

			// Execute
			await listFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(listFiles).toHaveBeenCalledWith(path.resolve("/test", "src"), true, 200)
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await listFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalled()
			expect(listFiles).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing path parameter", async () => {
			// Setup
			mockToolUse.params = {}

			// Execute
			await listFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("list_files", "path")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			;(listFiles as jest.Mock).mockRejectedValue(error)

			// Execute
			await listFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("listing files", error)
		})
	})
})
