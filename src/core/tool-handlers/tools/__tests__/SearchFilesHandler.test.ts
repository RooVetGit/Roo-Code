import * as path from "path"
import { SearchFilesHandler } from "../SearchFilesHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { regexSearchFiles } from "../../../../services/ripgrep" // Import the function to mock
import { RooIgnoreController } from "../../../ignore/RooIgnoreController"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { getReadablePath } from "../../../../utils/path"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../../services/ripgrep")
const mockRegexSearchFiles = regexSearchFiles as jest.Mock

jest.mock("../../../ignore/RooIgnoreController")
const MockRooIgnoreController = RooIgnoreController as jest.MockedClass<typeof RooIgnoreController>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text), // Simple mock
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

describe("SearchFilesHandler", () => {
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
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "search_files",
			params: {
				path: "src",
				regex: "console\\.log",
				file_pattern: "*.ts", // Optional
			},
			partial: false,
		}

		// Default search mock
		mockRegexSearchFiles.mockResolvedValue("Found 3 matches:\nfile1.ts:10: console.log('hello')\n...")
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should throw if regex is missing", () => {
		delete mockToolUse.params.regex
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'regex'")
	})

	test("validateParams should not throw if optional file_pattern is missing", () => {
		delete mockToolUse.params.file_pattern
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "searchFiles",
				path: mockToolUse.params.path,
				regex: mockToolUse.params.regex,
				filePattern: mockToolUse.params.file_pattern,
				content: "",
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if path param is missing", async () => {
		delete mockToolUse.params.path
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "path")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing path")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if regex param is missing", async () => {
		delete mockToolUse.params.regex
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("search_files", "regex")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing regex")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should call search, ask approval, and push result", async () => {
		const searchResult = "Found matches..."
		mockRegexSearchFiles.mockResolvedValue(searchResult)
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRegexSearchFiles).toHaveBeenCalledWith(
			"/workspace", // cwd
			path.resolve("/workspace", "src"), // absolute path
			"console\\.log", // regex
			"*.ts", // file_pattern
			mockRooIgnoreControllerInstance,
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining(`"content":"${searchResult}"`),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, searchResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "search_files")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should call search without file_pattern if not provided", async () => {
		delete mockToolUse.params.file_pattern
		const searchResult = "Found other matches..."
		mockRegexSearchFiles.mockResolvedValue(searchResult)
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRegexSearchFiles).toHaveBeenCalledWith(
			"/workspace",
			path.resolve("/workspace", "src"),
			"console\\.log",
			undefined, // file_pattern should be undefined
			mockRooIgnoreControllerInstance,
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining(`"content":"${searchResult}"`),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, searchResult)
	})

	test("handleComplete should skip push if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRegexSearchFiles).toHaveBeenCalled() // Search still happens
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during search", async () => {
		const searchError = new Error("Ripgrep failed")
		mockRegexSearchFiles.mockRejectedValue(searchError) // Make search throw
		const handler = new SearchFilesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRegexSearchFiles).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled() // Error before approval
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "searching files", searchError)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
	})
})
