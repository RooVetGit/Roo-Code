import path from "path"
import { searchFilesTool } from "../searchFilesTool"
import { Task } from "../../task/Task"
import { SearchFilesToolUse } from "../../../shared/tools"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { regexSearchFiles } from "../../../services/ripgrep"
import { RooIgnoreController } from "../../ignore/RooIgnoreController"

// Mock dependencies
jest.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: jest.fn(),
}))

jest.mock("../../../services/ripgrep", () => ({
	regexSearchFiles: jest.fn(),
}))

jest.mock("../../../utils/path", () => ({
	getReadablePath: jest.fn((cwd: string, relPath: string) => relPath),
}))

jest.mock("../../ignore/RooIgnoreController")

const mockedIsPathOutsideWorkspace = isPathOutsideWorkspace as jest.MockedFunction<typeof isPathOutsideWorkspace>
const mockedRegexSearchFiles = regexSearchFiles as jest.MockedFunction<typeof regexSearchFiles>

describe("searchFilesTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock

	beforeEach(() => {
		jest.clearAllMocks()

		mockTask = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			recordToolError: jest.fn(),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			rooIgnoreController: new RooIgnoreController("/workspace"),
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn()
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn((tag: string, value: string | undefined) => value || "")

		mockedRegexSearchFiles.mockResolvedValue("Search results")
	})

	describe("workspace boundary validation", () => {
		it("should allow search within workspace", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "src",
					regex: "test",
					file_pattern: "*.ts",
				},
				partial: false,
			}

			mockedIsPathOutsideWorkspace.mockReturnValue(false)

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockedIsPathOutsideWorkspace).toHaveBeenCalledWith(path.resolve("/workspace", "src"))
			expect(mockedRegexSearchFiles).toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith("Search results")
		})

		it("should block search outside workspace", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "../external",
					regex: "test",
					file_pattern: "*.ts",
				},
				partial: false,
			}

			mockedIsPathOutsideWorkspace.mockReturnValue(true)

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockedIsPathOutsideWorkspace).toHaveBeenCalledWith(path.resolve("/workspace", "../external"))
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Cannot search outside workspace. Path '../external' is outside the current workspace.",
			)
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("search_files")
		})

		it("should block search with absolute path outside workspace", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "/etc/passwd",
					regex: "root",
				},
				partial: false,
			}

			mockedIsPathOutsideWorkspace.mockReturnValue(true)

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockedIsPathOutsideWorkspace).toHaveBeenCalledWith(path.resolve("/workspace", "/etc/passwd"))
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Cannot search outside workspace. Path '/etc/passwd' is outside the current workspace.",
			)
		})

		it("should handle relative paths that resolve outside workspace", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "../../..",
					regex: "sensitive",
				},
				partial: false,
			}

			mockedIsPathOutsideWorkspace.mockReturnValue(true)

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockedIsPathOutsideWorkspace).toHaveBeenCalledWith(path.resolve("/workspace", "../../.."))
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Cannot search outside workspace. Path '../../..' is outside the current workspace.",
			)
		})
	})

	describe("existing functionality", () => {
		beforeEach(() => {
			mockedIsPathOutsideWorkspace.mockReturnValue(false)
		})

		it("should handle missing path parameter", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					regex: "test",
				},
				partial: false,
			}

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "path")
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
		})

		it("should handle missing regex parameter", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "src",
				},
				partial: false,
			}

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "regex")
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
		})

		it("should handle partial blocks", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "src",
					regex: "test",
				},
				partial: true,
			}

			const mockAsk = jest.fn()
			mockTask.ask = mockAsk

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockAsk).toHaveBeenCalled()
			expect(mockedRegexSearchFiles).not.toHaveBeenCalled()
		})

		it("should handle user rejection", async () => {
			const block: SearchFilesToolUse = {
				type: "tool_use",
				name: "search_files",
				params: {
					path: "src",
					regex: "test",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(false)

			await searchFilesTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockedRegexSearchFiles).toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})
})
