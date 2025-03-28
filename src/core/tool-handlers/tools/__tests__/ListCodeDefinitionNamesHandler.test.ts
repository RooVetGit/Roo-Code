import * as path from "path"
import * as fs from "fs/promises"
import { ListCodeDefinitionNamesHandler } from "../ListCodeDefinitionNamesHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { RooIgnoreController } from "../../../ignore/RooIgnoreController"
import {
	parseSourceCodeDefinitionsForFile,
	parseSourceCodeForDefinitionsTopLevel,
} from "../../../../services/tree-sitter"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { getReadablePath } from "../../../../utils/path"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("fs/promises", () => ({
	stat: jest.fn(), // Will configure per test
}))
const mockFsStat = fs.stat as jest.Mock

jest.mock("../../../ignore/RooIgnoreController")
const MockRooIgnoreController = RooIgnoreController as jest.MockedClass<typeof RooIgnoreController>

jest.mock("../../../../services/tree-sitter")
const mockParseFile = parseSourceCodeDefinitionsForFile as jest.Mock
const mockParseDir = parseSourceCodeForDefinitionsTopLevel as jest.Mock

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text), // Simple mock
		rooIgnoreError: jest.fn((file) => `RooIgnore Error: ${file}`),
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

describe("ListCodeDefinitionNamesHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockRooIgnoreControllerInstance: jest.MockedObject<RooIgnoreController>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockRooIgnoreControllerInstance = new MockRooIgnoreController(
			"/workspace",
		) as jest.MockedObject<RooIgnoreController>
		// Explicitly assign a mock function to validateAccess on the instance
		mockRooIgnoreControllerInstance.validateAccess = jest.fn().mockReturnValue(true) // Default: access allowed

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
			name: "list_code_definition_names",
			params: {
				path: "src/some_file.ts",
			},
			partial: false,
		}

		// Default stat mock (file)
		mockFsStat.mockResolvedValue({
			isFile: () => true,
			isDirectory: () => false,
		})
		mockParseFile.mockResolvedValue("Parsed file definitions")
		mockParseDir.mockResolvedValue("Parsed directory definitions")
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should not throw if path is present", () => {
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "listCodeDefinitionNames",
				path: mockToolUse.params.path,
				content: "",
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if path param is missing", async () => {
		delete mockToolUse.params.path
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith(
			"list_code_definition_names",
			"path",
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing path")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should parse file, ask approval, and push result", async () => {
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalledWith(path.resolve("/workspace", "src/some_file.ts"))
		expect(mockRooIgnoreControllerInstance.validateAccess).toHaveBeenCalledWith("src/some_file.ts")
		expect(mockParseFile).toHaveBeenCalledWith(
			path.resolve("/workspace", "src/some_file.ts"),
			mockRooIgnoreControllerInstance,
		)
		expect(mockParseDir).not.toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"content":"Parsed file definitions"'),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Parsed file definitions")
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(
			mockClineInstance.taskId,
			"list_code_definition_names",
		)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should parse directory, ask approval, and push result", async () => {
		mockToolUse.params.path = "src/some_dir"
		mockFsStat.mockResolvedValue({ isFile: () => false, isDirectory: () => true }) // Mock as directory
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalledWith(path.resolve("/workspace", "src/some_dir"))
		expect(mockRooIgnoreControllerInstance.validateAccess).not.toHaveBeenCalled() // Not called for dir
		expect(mockParseDir).toHaveBeenCalledWith(
			path.resolve("/workspace", "src/some_dir"),
			mockRooIgnoreControllerInstance,
		)
		expect(mockParseFile).not.toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"content":"Parsed directory definitions"'),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Parsed directory definitions")
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(
			mockClineInstance.taskId,
			"list_code_definition_names",
		)
	})

	test("handleComplete should handle path not existing", async () => {
		const error = new Error("Not found") as NodeJS.ErrnoException
		error.code = "ENOENT"
		mockFsStat.mockRejectedValue(error)
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalled()
		expect(mockParseFile).not.toHaveBeenCalled()
		expect(mockParseDir).not.toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining("does not exist or cannot be accessed"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("does not exist or cannot be accessed"),
		)
	})

	test("handleComplete should handle path being neither file nor directory", async () => {
		mockFsStat.mockResolvedValue({ isFile: () => false, isDirectory: () => false }) // Mock as neither
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalled()
		expect(mockParseFile).not.toHaveBeenCalled()
		expect(mockParseDir).not.toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining("neither a file nor a directory"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("neither a file nor a directory"),
		)
	})

	test("handleComplete should fail if file access denied by rooignore", async () => {
		mockRooIgnoreControllerInstance.validateAccess.mockReturnValue(false) // Deny access
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalled()
		expect(mockRooIgnoreControllerInstance.validateAccess).toHaveBeenCalledWith("src/some_file.ts")
		expect(mockParseFile).not.toHaveBeenCalled()
		expect(mockParseDir).not.toHaveBeenCalled()
		expect(mockClineInstance.say).toHaveBeenCalledWith("rooignore_error", "src/some_file.ts")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"ERROR: RooIgnore Error: src/some_file.ts",
		)
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled()
	})

	test("handleComplete should skip push if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalled()
		expect(mockParseFile).toHaveBeenCalled() // Parsing still happens before approval
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during parsing", async () => {
		const parseError = new Error("Tree-sitter failed")
		mockParseFile.mockRejectedValue(parseError) // Make parsing throw
		const handler = new ListCodeDefinitionNamesHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFsStat).toHaveBeenCalled()
		expect(mockParseFile).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled() // Error before approval
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"parsing source code definitions",
			parseError,
		)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
	})
})
