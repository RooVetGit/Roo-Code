import { NewTaskHandler } from "../NewTaskHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getModeBySlug, defaultModeSlug } from "../../../../shared/modes"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import delay from "delay"
import { ClineProvider } from "../../../webview/ClineProvider" // Assuming path

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../webview/ClineProvider") // Mock the provider
const MockClineProvider = ClineProvider as jest.MockedClass<typeof ClineProvider>

jest.mock("../../../../shared/modes", () => ({
	getModeBySlug: jest.fn((slug) => {
		if (slug === "code") return { slug: "code", name: "Code Mode" }
		if (slug === "ask") return { slug: "ask", name: "Ask Mode" }
		return undefined // Simulate invalid mode
	}),
	defaultModeSlug: "code",
}))

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

jest.mock("delay") // Mock delay

describe("NewTaskHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockProviderInstance: jest.MockedObject<ClineProvider>
	let mockToolUse: ToolUse
	let mockNewClineInstance: jest.MockedObject<Cline>

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock vscode context and output channel
		const mockVsCodeContext = {
			extensionUri: { fsPath: "/mock/extension/path" },
			globalState: { get: jest.fn(), update: jest.fn() }, // Add basic globalState mock
			secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() }, // Add basic secrets mock
		} as any
		const mockOutputChannel = { appendLine: jest.fn() } as any

		// Mock provider instance and its methods
		mockProviderInstance = new MockClineProvider(
			mockVsCodeContext,
			mockOutputChannel,
		) as jest.MockedObject<ClineProvider>

		// Use mockResolvedValue or mockImplementation for async methods
		mockProviderInstance.getState.mockResolvedValue({
			customModes: [],
			apiConfiguration: { apiProvider: "anthropic", modelId: "claude-3-opus-20240229" }, // Example config
			mode: "code",
			customInstructions: "",
			experiments: {},
			// Add other necessary state properties with default values
		} as any) // Use 'as any' for simplicity if full state type is complex

		mockProviderInstance.handleModeSwitch.mockResolvedValue()
		mockProviderInstance.initClineWithTask.mockResolvedValue(mockNewClineInstance)

		// Mock the new Cline instance that will be created
		mockNewClineInstance = {
			taskId: "new-task-id",
			// Add other properties if needed by the handler or tests
		} as unknown as jest.MockedObject<Cline>
		// Note: initClineWithTask mock is now above this line

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "parent-task-id",
			providerRef: { deref: () => mockProviderInstance }, // Provide mock provider
			ask: jest.fn(() => Promise.resolve({})),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			emit: jest.fn(), // Mock emit
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value),
			// Mock properties related to pausing (if needed, ensure they are mockable)
			// isPaused: false, // Example if needed and mockable
			// pausedModeSlug: defaultModeSlug, // Example if needed and mockable
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "new_task",
			params: {
				mode: "ask",
				message: "What is TypeScript?",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if mode is missing", () => {
		delete mockToolUse.params.mode
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'mode'")
	})

	test("validateParams should throw if message is missing", () => {
		delete mockToolUse.params.message
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'message'")
	})

	test("validateParams should not throw if mode and message are present", () => {
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "newTask",
				mode: mockToolUse.params.mode,
				message: mockToolUse.params.message,
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if mode param is missing", async () => {
		delete mockToolUse.params.mode
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("new_task", "mode")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing mode")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if message param is missing", async () => {
		delete mockToolUse.params.message
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("new_task", "message")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing message")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if providerRef is lost", async () => {
		mockClineInstance.providerRef.deref = () => undefined // Simulate lost ref
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"creating new task",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain(
			"ClineProvider reference is lost",
		)
	})

	test("handleComplete should fail if mode is invalid", async () => {
		mockToolUse.params.mode = "invalid_mode"
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(getModeBySlug).toHaveBeenCalledWith("invalid_mode", [])
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "ERROR: Invalid mode: invalid_mode")
		expect(mockProviderInstance.handleModeSwitch).not.toHaveBeenCalled()
		expect(mockProviderInstance.initClineWithTask).not.toHaveBeenCalled()
	})

	test("handleComplete should ask approval, switch mode, init task, emit events, and push result", async () => {
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Verify state and mode check
		expect(mockProviderInstance.getState).toHaveBeenCalled()
		expect(getModeBySlug).toHaveBeenCalledWith(mockToolUse.params.mode, [])

		// Verify approval
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"tool":"newTask"') &&
				expect.stringContaining('"mode":"Ask Mode"') && // Uses mode name
				expect.stringContaining(`"content":"${mockToolUse.params.message}"`),
		)

		// Verify actions
		expect(mockProviderInstance.handleModeSwitch).toHaveBeenCalledWith(mockToolUse.params.mode)
		expect(delay).toHaveBeenCalledWith(500)
		expect(mockProviderInstance.initClineWithTask).toHaveBeenCalledWith(
			mockToolUse.params.message,
			undefined, // No images
			mockClineInstance, // Parent task
		)
		expect(mockClineInstance.emit).toHaveBeenCalledWith("taskSpawned", "new-task-id")
		expect(mockClineInstance.emit).toHaveBeenCalledWith("taskPaused")

		// Verify result and telemetry
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Successfully created new task in Ask Mode mode"),
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "new_task")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should skip actions if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockProviderInstance.handleModeSwitch).not.toHaveBeenCalled()
		expect(delay).not.toHaveBeenCalled()
		expect(mockProviderInstance.initClineWithTask).not.toHaveBeenCalled()
		expect(mockClineInstance.emit).not.toHaveBeenCalledWith("taskSpawned", expect.anything())
		expect(mockClineInstance.emit).not.toHaveBeenCalledWith("taskPaused")
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during task creation", async () => {
		const initError = new Error("Failed to init")
		mockProviderInstance.initClineWithTask.mockRejectedValue(initError) // Make init throw
		const handler = new NewTaskHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockProviderInstance.handleModeSwitch).toHaveBeenCalled()
		expect(delay).toHaveBeenCalled()
		expect(mockProviderInstance.initClineWithTask).toHaveBeenCalled()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "creating new task", initError)
		expect(mockClineInstance.emit).not.toHaveBeenCalledWith("taskSpawned", expect.anything())
		expect(mockClineInstance.emit).not.toHaveBeenCalledWith("taskPaused")
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
	})
})
