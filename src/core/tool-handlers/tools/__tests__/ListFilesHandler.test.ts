import * as path from "path"
import { ListFilesHandler } from "../ListFilesHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { listFiles } from "../../../../services/glob/list-files" // Import the function to mock
import { RooIgnoreController } from "../../../ignore/RooIgnoreController"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { getReadablePath } from "../../../../utils/path"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../../services/glob/list-files")
const mockListFiles = listFiles as jest.Mock

jest.mock("../../../ignore/RooIgnoreController")
const MockRooIgnoreController = RooIgnoreController as jest.MockedClass<typeof RooIgnoreController>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text), // Simple mock
		formatFilesList: jest.fn(
			(absPath, files, limitHit, ignoreController, showIgnored) =>
				`Formatted list for ${absPath}: ${files.join(", ")}${limitHit ? " (limit hit)" : ""}${showIgnored ? " (showing ignored)" : ""}`,
		),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn((cwd, p) => p || "mock/path"), // Simple mock
}))

describe("ListFilesHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockRooIgnoreControllerInstance: jest.MockedObject<RooIgnoreController>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockRooIgnoreControllerInstance = new MockRooIgnoreController(
			"/workspace",
		) as jest.MockedObject<RooIgnoreController>
		// No methods needed for default mock in this handler

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			rooIgnoreController: mockRooIgnoreControllerInstance,
			ask: jest.fn(() => Promise.resolve({})),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			providerRef: { deref: () => ({ getState: () => Promise.resolve({ showRooIgnoredFiles: true }) }) }, // Mock provider state
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "list_files",
			params: {
				path: "src/some_dir",
				recursive: "false", // Default non-recursive
			},
			partial: false,
		}

		// Default listFiles mock
		mockListFiles.mockResolvedValue([["file1.ts", "file2.js"], false]) // [files, didHitLimit]
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should not throw if path is present", () => {
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with listFilesTopLevel for non-recursive", async () => {
		mockToolUse.partial = true
		mockToolUse.params.recursive = "false"
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "listFilesTopLevel",
				path: mockToolUse.params.path,
				content: "",
			}),
			true,
		)
	})

	test("handlePartial should call ask with listFilesRecursive for recursive", async () => {
		mockToolUse.partial = true
		mockToolUse.params.recursive = "true"
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "listFilesRecursive",
				path: mockToolUse.params.path,
				content: "",
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if path param is missing", async () => {
		delete mockToolUse.params.path
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("list_files", "path")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing path")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should call listFiles (non-recursive), format, ask approval, and push result", async () => {
		mockToolUse.params.recursive = "false"
		const expectedFiles = ["fileA.txt", "fileB.log"]
		const expectedLimitHit = false
		mockListFiles.mockResolvedValue([expectedFiles, expectedLimitHit])
		const expectedFormattedResult = `Formatted list for /workspace/src/some_dir: ${expectedFiles.join(", ")} (showing ignored)`
		;(formatResponse.formatFilesList as jest.Mock).mockReturnValue(expectedFormattedResult)

		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockListFiles).toHaveBeenCalledWith(path.resolve("/workspace", "src/some_dir"), false, 200)
		expect(formatResponse.formatFilesList).toHaveBeenCalledWith(
			path.resolve("/workspace", "src/some_dir"),
			expectedFiles,
			expectedLimitHit,
			mockRooIgnoreControllerInstance,
			true, // showRooIgnoredFiles from mock state
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining(`"content":"${expectedFormattedResult}"`),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, expectedFormattedResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "list_files")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should call listFiles (recursive), format, ask approval, and push result", async () => {
		mockToolUse.params.recursive = "true"
		const expectedFiles = ["fileA.txt", "subdir/fileC.ts"]
		const expectedLimitHit = true
		mockListFiles.mockResolvedValue([expectedFiles, expectedLimitHit])
		const expectedFormattedResult = `Formatted list for /workspace/src/some_dir: ${expectedFiles.join(", ")} (limit hit) (showing ignored)`
		;(formatResponse.formatFilesList as jest.Mock).mockReturnValue(expectedFormattedResult)

		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockListFiles).toHaveBeenCalledWith(path.resolve("/workspace", "src/some_dir"), true, 200) // Recursive true
		expect(formatResponse.formatFilesList).toHaveBeenCalledWith(
			path.resolve("/workspace", "src/some_dir"),
			expectedFiles,
			expectedLimitHit,
			mockRooIgnoreControllerInstance,
			true,
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining(`"content":"${expectedFormattedResult}"`),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, expectedFormattedResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "list_files")
	})

	test("handleComplete should skip push if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockListFiles).toHaveBeenCalled() // Listing still happens
		expect(formatResponse.formatFilesList).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during listFiles", async () => {
		const listError = new Error("Failed to list")
		mockListFiles.mockRejectedValue(listError) // Make listing throw
		const handler = new ListFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockListFiles).toHaveBeenCalled()
		expect(formatResponse.formatFilesList).not.toHaveBeenCalled() // Error before formatting
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled() // Error before approval
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "listing files", listError)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
	})
})
