import * as vscode from "vscode"
import { writeToFileTool } from "../writeToFileTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../../shared/tools"
import { mock } from "jest-mock-extended"

// Mock vscode APIs
jest.mock("vscode", () => ({
	...jest.requireActual("vscode"),
	window: {
		showWarningMessage: jest.fn(),
		showErrorMessage: jest.fn(),
	},
	env: {
		openExternal: jest.fn(),
	},
	Uri: {
		parse: jest.fn(),
	},
	workspace: {
		fs: {
			writeFile: jest.fn(),
			readFile: jest.fn(),
			stat: jest.fn().mockResolvedValue({ type: 0, ctime: 0, mtime: 0, size: 0 }), // Mock stat to simulate file not existing initially
		},
		applyEdit: jest.fn(),
		getConfiguration: jest.fn(() => ({
			get: jest.fn(),
		})),
	},
}))

// Mock other dependencies
jest.mock("../../Cline")
jest.mock("../../../utils/fs", () => ({
	...jest.requireActual("../../../utils/fs"),
	fileExistsAtPath: jest.fn().mockResolvedValue(false), // Default to file not existing
}))
jest.mock("../../context-tracking/FileContextTracker", () => ({
	FileContextTracker: jest.fn().mockImplementation(() => ({
		trackFileContext: jest.fn().mockResolvedValue(undefined),
	})),
}))

describe("writeToFileTool", () => {
	let mockCline: Cline // Changed type from jest.Mocked<Cline> to Cline
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock Cline instance and its methods/properties
		mockCline = mock<Cline>({
			cwd: "/test/workspace",
			diffViewProvider: {
				editType: undefined,
				isEditing: false,
				originalContent: "",
				open: jest.fn().mockResolvedValue(undefined),
				update: jest.fn().mockResolvedValue(undefined),
				revertChanges: jest.fn().mockResolvedValue(undefined),
				saveChanges: jest.fn().mockResolvedValue({ newProblemsMessage: "", userEdits: null, finalContent: "" }),
				reset: jest.fn().mockResolvedValue(undefined),
				scrollToFirstDiff: jest.fn(),
			},
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
			api: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				getModel: jest.fn().mockReturnValue({ id: "claude-test-model" }) as any,
			},
			getFileContextTracker: jest.fn().mockReturnValue({
				trackFileContext: jest.fn().mockResolvedValue(undefined),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			}) as any,
			say: jest.fn().mockResolvedValue(undefined),
			ask: jest.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing param error"),
			recordToolError: jest.fn(),
			diffStrategy: undefined, // Set to undefined
			diffEnabled: false, // Explicitly set diffEnabled
			consecutiveMistakeCount: 0,
		})

		mockAskApproval = jest.fn().mockResolvedValue(true) // Default to approval
		mockHandleError = jest.fn()
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn((_paramName, value) => value) // Simple pass-through
	})

	it("should successfully write a file with only newlines", async () => {
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use", // Corrected type
			partial: false, // Added partial
			params: {
				path: "test_newlines.txt",
				content: "\n\n\n",
				line_count: "3",
			},
		}

		// Simulate file not existing initially
		;(vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error("File not found"))
		const fileExistsAtPathMock = jest.requireMock("../../../utils/fs").fileExistsAtPath
		fileExistsAtPathMock.mockResolvedValueOnce(false)

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify diffViewProvider was used to open and update
		expect(mockCline.diffViewProvider.open).toHaveBeenCalledWith("test_newlines.txt")
		expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("\n\n\n", true)

		// Verify approval was sought
		expect(mockAskApproval).toHaveBeenCalled()

		// Verify saveChanges was called
		expect(mockCline.diffViewProvider.saveChanges).toHaveBeenCalled()

		// Verify pushToolResult was called with a success message
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("The content was successfully saved to test_newlines.txt"),
		)
		expect(mockHandleError).not.toHaveBeenCalled()
	})

	it("should successfully write a file with only newlines and backticks", async () => {
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use", // Corrected type
			partial: false, // Added partial
			params: {
				path: "test_newlines_with_backticks.txt",
				content: "```\n\n\n```", // This input has 4 newlines. After stripping, 1 newline remains.
				line_count: "1", // Expected final line_count (1 newline)
			},
		}

		// Simulate file not existing initially
		;(vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error("File not found"))
		const fileExistsAtPathMock = jest.requireMock("../../../utils/fs").fileExistsAtPath
		fileExistsAtPathMock.mockResolvedValueOnce(false)

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockCline.diffViewProvider.open).toHaveBeenCalledWith("test_newlines_with_backticks.txt")
		// The content passed to update should be the raw newlines after stripping backticks
		expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("\n", true) // Expect 1 newline
		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockCline.diffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("The content was successfully saved to test_newlines_with_backticks.txt"),
		)
		expect(mockHandleError).not.toHaveBeenCalled()
	})

	it("should overwrite an existing file if user approves", async () => {
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use",
			partial: false,
			params: {
				path: "existing_file.txt",
				content: "new content",
				line_count: "1",
			},
		}

		// Simulate file existing
		const fileExistsAtPathMock = jest.requireMock("../../../utils/fs").fileExistsAtPath
		fileExistsAtPathMock.mockResolvedValueOnce(true)
		;(vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from("old content"))
		;(vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({
			type: vscode.FileType.File,
			ctime: 0,
			mtime: 0,
			size: 11,
		}) // Simulate file exists

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockCline.diffViewProvider.open).toHaveBeenCalledWith("existing_file.txt")
		expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("new content", false) // isNewFile should be false
		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockCline.diffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("The content was successfully saved to existing_file.txt"),
		)
		expect(mockHandleError).not.toHaveBeenCalled()
	})

	it("should handle error during file writing when diff view is not used", async () => {
		// Ensure diffEnabled is false for this test, which is the default from beforeEach
		mockCline.diffEnabled = false
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use",
			partial: false,
			params: {
				path: "error_file.txt",
				content: "some content",
				line_count: "1",
			},
		}

		// Simulate file not existing initially
		const fileExistsAtPathMock = jest.requireMock("../../../utils/fs").fileExistsAtPath
		fileExistsAtPathMock.mockResolvedValueOnce(false)
		;(vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error("File not found"))

		// Mock saveChanges to throw an error for this specific test case
		// when diffEnabled is false, saveChanges would internally call vscode.workspace.fs.writeFile
		mockCline.diffViewProvider.saveChanges = jest
			.fn()
			.mockRejectedValueOnce(new Error("FS write error from saveChanges"))

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Approval should still be asked before attempting to write
		expect(mockAskApproval).toHaveBeenCalled()
		// We are mocking saveChanges to throw, so we don't check vscode.workspace.fs.writeFile directly here.
		// The handleError should be called due to the error thrown by the mocked saveChanges.
		expect(mockHandleError).toHaveBeenCalledWith(
			"writing file", // This is the context string used in writeToFileTool's catch block
			expect.objectContaining({ message: "FS write error from saveChanges" }),
		)
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should call sayAndCreateMissingParamError if path is missing", async () => {
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use",
			partial: false,
			params: {
				// path is missing
				content: "some content",
				line_count: "1",
			},
		}

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith(toolUse.name, "path")
		expect(mockAskApproval).not.toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith("Missing param error")
		expect(mockHandleError).not.toHaveBeenCalled()
	})

	it("should call sayAndCreateMissingParamError if content is missing", async () => {
		const toolUse: ToolUse = {
			name: "write_to_file",
			type: "tool_use",
			partial: false,
			params: {
				path: "some_path.txt",
				// content is missing
				line_count: "1",
			},
		}

		await writeToFileTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith(toolUse.name, "content")
		expect(mockAskApproval).not.toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith("Missing param error")
		expect(mockHandleError).not.toHaveBeenCalled()
	})
})
