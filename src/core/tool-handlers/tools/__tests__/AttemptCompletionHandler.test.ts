import { AttemptCompletionHandler } from "../AttemptCompletionHandler"
import { Cline, ToolResponse } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { Anthropic } from "@anthropic-ai/sdk" // Needed for feedback formatting

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text), // Simple mock for now
		imageBlocks: jest.fn((images) =>
			images
				? images.map((img: any) => ({
						type: "image",
						source: { type: "base64", media_type: "image/png", data: img.uri },
					}))
				: [],
		),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
		captureTaskCompleted: jest.fn(),
	},
}))

// Mock the providerRef.deref().finishSubTask part
const mockProvider = {
	finishSubTask: jest.fn(() => Promise.resolve()),
	getState: jest.fn(() => Promise.resolve({})), // Add getState if needed by Cline mock
}

describe("AttemptCompletionHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			clineMessages: [], // Initialize empty messages
			taskId: "test-task-id",
			parentTask: undefined, // Default to main task
			didRejectTool: false,
			ask: jest.fn(() =>
				Promise.resolve({ response: "messageResponse", text: "User feedback", images: undefined }),
			), // Default ask response (feedback)
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval for command
			executeCommandTool: jest.fn(() => Promise.resolve([false, "Command executed successfully"])), // Default command execution success
			providerRef: { deref: () => mockProvider }, // Use mock provider
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({ completion_tokens: 10, prompt_tokens: 5, total_tokens: 15 })), // Mock token usage
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "attempt_completion",
			params: {
				result: "Task completed successfully.",
				// command: "echo 'Done'" // Optional command
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if result is missing", () => {
		delete mockToolUse.params.result
		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'result'")
	})

	test("validateParams should not throw if command is missing", () => {
		delete mockToolUse.params.command
		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call say with result when only result is partial", async () => {
		mockToolUse.partial = true
		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			true,
		)
		expect(mockClineInstance.ask).not.toHaveBeenCalled()
	})

	test("handlePartial should finalize say and call ask when command starts streaming", async () => {
		mockToolUse.partial = true
		mockToolUse.params.command = "echo 'Done'"
		// Simulate previous partial result message
		mockClineInstance.clineMessages.push({ say: "completion_result", partial: true } as any)

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Finalize result 'say'
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)

		// Start command 'ask'
		expect(mockClineInstance.ask).toHaveBeenCalledWith("command", mockToolUse.params.command, true)
	})

	test("handlePartial should say result completely if command starts streaming without prior partial result", async () => {
		mockToolUse.partial = true
		mockToolUse.params.command = "echo 'Done'"
		// No prior partial message

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Send complete result 'say' first
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)

		// Start command 'ask'
		expect(mockClineInstance.ask).toHaveBeenCalledWith("command", mockToolUse.params.command, true)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if result param is missing", async () => {
		delete mockToolUse.params.result
		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("attempt_completion", "result")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing result")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should say result and ask for feedback when no command", async () => {
		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled()
		expect(mockClineInstance.executeCommandTool).not.toHaveBeenCalled()
		expect(mockClineInstance.ask).toHaveBeenCalledWith("completion_result", "", false) // Ask for feedback
		expect(mockClineInstance.say).toHaveBeenCalledWith("user_feedback", "User feedback", undefined) // Show feedback
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.arrayContaining([
				expect.objectContaining({
					type: "text",
					text: expect.stringContaining("<feedback>\nUser feedback\n</feedback>"),
				}),
			]),
		)
	})

	test("handleComplete should execute command, ask for feedback when command present and approved", async () => {
		mockToolUse.params.command = "echo 'Done'"
		const commandOutput = "Command executed successfully"
		;(mockClineInstance.executeCommandTool as jest.Mock).mockResolvedValue([false, commandOutput])

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		) // Say result first
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.ask).toHaveBeenCalledWith("completion_result", "", false) // Ask for feedback
		expect(mockClineInstance.say).toHaveBeenCalledWith("user_feedback", "User feedback", undefined) // Show feedback
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.arrayContaining([
				expect.objectContaining({ type: "text", text: commandOutput }), // Include command output
				expect.objectContaining({
					type: "text",
					text: expect.stringContaining("<feedback>\nUser feedback\n</feedback>"),
				}),
			]),
		)
	})

	test("handleComplete should not execute command if rejected", async () => {
		mockToolUse.params.command = "echo 'Done'"
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Reject command

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).not.toHaveBeenCalled()
		expect(mockClineInstance.ask).not.toHaveBeenCalledWith("completion_result", "", false) // Should not ask for feedback
		// pushToolResult is handled by askApprovalHelper on rejection
	})

	test("handleComplete should handle command execution rejection", async () => {
		mockToolUse.params.command = "echo 'Fail'"
		const rejectionMessage = "User rejected command execution"
		;(mockClineInstance.executeCommandTool as jest.Mock).mockResolvedValue([true, rejectionMessage]) // Simulate user rejection during execution

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.didRejectTool).toBe(true)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, rejectionMessage) // Push the rejection feedback
		expect(mockClineInstance.ask).not.toHaveBeenCalledWith("completion_result", "", false) // Should not ask for general feedback
	})

	test("handleComplete should handle errors during command execution", async () => {
		mockToolUse.params.command = "echo 'Error'"
		const commandError = new Error("Command failed")
		;(mockClineInstance.executeCommandTool as jest.Mock).mockRejectedValue(commandError)

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"command",
			mockToolUse.params.command,
		)
		expect(mockClineInstance.executeCommandTool).toHaveBeenCalledWith(mockToolUse.params.command)
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"attempting completion",
			commandError,
		)
	})

	test("handleComplete should finish subtask if parentTask exists", async () => {
		// Re-create mock instance for this test with parentTask defined
		const subtaskMockClineInstance = {
			...mockClineInstance, // Spread properties from the base mock
			parentTask: "parent-task-id", // Set the read-only property for this test case
		} as unknown as jest.MockedObject<Cline> // Cast needed due to overriding

		const handler = new AttemptCompletionHandler(subtaskMockClineInstance, mockToolUse)
		await handler.handle()

		expect(subtaskMockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockProvider.finishSubTask).toHaveBeenCalledWith(`Task complete: ${mockToolUse.params.result}`)
		expect(mockClineInstance.ask).not.toHaveBeenCalledWith("completion_result", "", false) // Should not ask for feedback
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Should not push result for subtask finish
	})

	test("handleComplete should push empty result if user clicks 'New Task'", async () => {
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({
			response: "yesButtonClicked",
			text: null,
			images: null,
		}) // Simulate "New Task" click

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(telemetryService.captureTaskCompleted).toHaveBeenCalledWith(mockClineInstance.taskId)
		expect(mockClineInstance.emit).toHaveBeenCalledWith(
			"taskCompleted",
			mockClineInstance.taskId,
			expect.any(Object),
		)
		expect(mockClineInstance.ask).toHaveBeenCalledWith("completion_result", "", false)
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("user_feedback", expect.anything(), expect.anything()) // No feedback to show
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "") // Push empty result
	})

	test("handleComplete should format feedback with images correctly", async () => {
		const feedbackImages = [{ uri: "feedback.png" }]
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({
			response: "messageResponse",
			text: "Feedback with image",
			images: feedbackImages,
		})

		const handler = new AttemptCompletionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"completion_result",
			mockToolUse.params.result,
			undefined,
			false,
		)
		expect(mockClineInstance.ask).toHaveBeenCalledWith("completion_result", "", false)
		expect(mockClineInstance.say).toHaveBeenCalledWith("user_feedback", "Feedback with image", feedbackImages)
		expect(formatResponse.imageBlocks).toHaveBeenCalledWith(feedbackImages)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.arrayContaining([
				expect.objectContaining({
					type: "text",
					text: expect.stringContaining("<feedback>\nFeedback with image\n</feedback>"),
				}),
				expect.objectContaining({ type: "image", source: expect.any(Object) }), // Check for image block presence
			]),
		)
	})
})
