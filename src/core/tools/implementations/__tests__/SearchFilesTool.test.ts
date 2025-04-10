// npx jest src/core/tools/implementations/__tests__/SearchFilesTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { SearchFilesTool } from "../SearchFilesTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { regexSearchFiles } from "../../../../services/ripgrep"
import path from "path"

// Mock dependencies
jest.mock("../../../../services/ripgrep")
jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn().mockImplementation((cwd, path) => path),
}))

describe("SearchFilesTool", () => {
	// Setup common test variables
	let searchFilesTool: SearchFilesTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
		cwd: string
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
			rooIgnoreController: {},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			cwd: string
			rooIgnoreController: any
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "search_files",
			params: {
				path: "src",
				regex: "function",
				file_pattern: "*.ts",
			},
			partial: false,
		}

		// Mock regexSearchFiles function
		;(regexSearchFiles as jest.Mock).mockResolvedValue("Search results")

		// Create SearchFilesTool instance
		searchFilesTool = new SearchFilesTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(searchFilesTool.getName()).toBe("search_files")
		})
	})

	describe("execute", () => {
		it("should search files successfully", async () => {
			// Execute
			await searchFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(regexSearchFiles).toHaveBeenCalledWith(
				"/test",
				path.resolve("/test", "src"),
				"function",
				"*.ts",
				mockCline.rooIgnoreController,
			)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith("Search results")
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await searchFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalled()
			expect(regexSearchFiles).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing path parameter", async () => {
			// Setup
			mockToolUse.params = {
				regex: "function",
			}

			// Execute
			await searchFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "path")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle missing regex parameter", async () => {
			// Setup
			mockToolUse.params = {
				path: "src",
			}

			// Execute
			await searchFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "regex")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			;(regexSearchFiles as jest.Mock).mockRejectedValue(error)

			// Execute
			await searchFilesTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("searching files", error)
		})
	})
})
