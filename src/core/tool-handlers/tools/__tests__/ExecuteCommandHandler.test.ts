import { ExecuteCommandHandler } from "../ExecuteCommandHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { RooIgnoreController } from "../../../ignore/RooIgnoreController" // Assuming path
import { telemetryService } from "../../../../services/telemetry/TelemetryService"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../ignore/RooIgnoreController") // Mock the RooIgnoreController class
const MockRooIgnoreController = RooIgnoreController as jest.MockedClass<typeof RooIgnoreController>

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

describe("ExecuteCommandHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockRooIgnoreControllerInstance: jest.MockedObject<RooIgnoreController>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		// Create mock instance for RooIgnoreController, providing mock CWD
		mockRooIgnoreControllerInstance = new MockRooIgnoreController(
			"/workspace",
		) as jest.MockedObject<RooIgnoreController>
		// Explicitly assign a mock function to validateCommand on the instance
		mockRooIgnoreControllerInstance.validateCommand = jest.fn().mockReturnValue(undefined) // Default: command is allowed

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			rooIgnoreController: mockRooIgnoreControllerInstance, // Assign mock instance
			didRejectTool: false,
			ask: jest.fn(() => Promise.resolve({})), // Default ask response
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			executeCommandTool: jest.fn(() => Promise.resolve([false, "Command output"])), // Default success
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value), // Simple mock
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "execute_command",
			params: {
				command: "echo 'hello'",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if command is missing", () => {
		delete mockToolUse.params.command
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'command'")
	})

	test("validateParams should not throw if cwd is missing", () => {
		delete mockToolUse.params.cwd
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with command and partial flag", async () => {
		mockToolUse.partial = true
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith("command", mockToolUse.params.command, true)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if command param is missing", async () => {
		delete mockToolUse.params.command
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("execute_command", "command")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing command")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if command accesses ignored file", async () => {
		const ignoredFile = ".env"
		mockRooIgnoreControllerInstance.validateCommand.mockReturnValue(ignoredFile)
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.say).toHaveBeenCalledWith("rooignore_error", ignoredFile)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"ERROR: RooIgnore Error: .env", // Based on mock formatResponse
		)
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled()
		expect(mockClineInstance.executeCommandTool).not.toHaveBeenCalled()
	})

	test("handleComplete should ask for approval and execute command", async () => {
		const commandResult = "Success output"
		;(mockClineInstance.executeCommandTool as jest.Mock).mockResolvedValue([false, commandResult])
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command, undefined) // No custom cwd
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, commandResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "execute_command")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should execute command with custom cwd", async () => {
		mockToolUse.params.cwd = "/custom/dir"
		const commandResult = "Success output in custom dir"
		;(mockClineInstance.executeCommandTool as jest.Mock).mockResolvedValue([false, commandResult])
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command, "/custom/dir") // Check custom cwd
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, commandResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "execute_command")
	})

	test("handleComplete should skip execution if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).not.toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
	})

	test("handleComplete should handle user rejection during execution", async () => {
		const rejectionResult = "User rejected during execution"
		;(mockClineInstance.executeCommandTool as jest.Mock).mockResolvedValue([true, rejectionResult]) // Simulate mid-execution rejection
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command, undefined)
		expect(mockClineInstance.didRejectTool).toBe(true) // Check rejection flag
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, rejectionResult) // Push the rejection result
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "execute_command")
	})

	test("handleComplete should handle errors during execution", async () => {
		const execError = new Error("Command failed")
		;(mockClineInstance.executeCommandTool as jest.Mock).mockRejectedValue(execError)
		const handler = new ExecuteCommandHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockRooIgnoreControllerInstance.validateCommand).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command, undefined)
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "executing command", execError)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Error helper handles result
	})
})
