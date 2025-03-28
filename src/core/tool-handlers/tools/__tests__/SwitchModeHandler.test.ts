import { SwitchModeHandler } from "../SwitchModeHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getModeBySlug, defaultModeSlug } from "../../../../shared/modes"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import delay from "delay"
import { ClineProvider } from "../../../webview/ClineProvider"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../webview/ClineProvider")
const MockClineProvider = ClineProvider as jest.MockedClass<typeof ClineProvider>

jest.mock("../../../../shared/modes", () => ({
	getModeBySlug: jest.fn((slug, _customModes) => {
		// Simple mock for testing existence and name retrieval
		if (slug === "code") return { slug: "code", name: "Code Mode" }
		if (slug === "ask") return { slug: "ask", name: "Ask Mode" }
		return undefined
	}),
	defaultModeSlug: "code",
}))

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

jest.mock("delay")

describe("SwitchModeHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockProviderInstance: jest.MockedObject<ClineProvider>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock provider instance and its methods
		const mockVsCodeContext = {
			extensionUri: { fsPath: "/mock/extension/path" },
			globalState: { get: jest.fn(), update: jest.fn() },
			secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
		} as any
		const mockOutputChannel = { appendLine: jest.fn() } as any
		mockProviderInstance = new MockClineProvider(
			mockVsCodeContext,
			mockOutputChannel,
		) as jest.MockedObject<ClineProvider>

		// Use mockResolvedValue for getState with a more complete structure
		mockProviderInstance.getState.mockResolvedValue({
			customModes: [],
			apiConfiguration: { apiProvider: "anthropic", modelId: "claude-3-opus-20240229" }, // Example
			mode: "code",
			customInstructions: "",
			experiments: {},
			// Add other necessary state properties with default values
		} as any) // Use 'as any' for simplicity

		// Use mockResolvedValue for handleModeSwitch (Jest should handle the args implicitly here)
		mockProviderInstance.handleModeSwitch.mockResolvedValue()

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			providerRef: { deref: () => mockProviderInstance },
			ask: jest.fn(() => Promise.resolve({})),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "switch_mode",
			params: {
				mode_slug: "ask", // Target mode
				reason: "Need to ask a question", // Optional
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if mode_slug is missing", () => {
		delete mockToolUse.params.mode_slug
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'mode_slug'")
	})

	test("validateParams should not throw if optional reason is missing", () => {
		delete mockToolUse.params.reason
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "switchMode",
				mode: mockToolUse.params.mode_slug,
				reason: mockToolUse.params.reason,
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if mode_slug param is missing", async () => {
		delete mockToolUse.params.mode_slug
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("switch_mode", "mode_slug")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing mode_slug")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if providerRef is lost", async () => {
		mockClineInstance.providerRef.deref = () => undefined // Simulate lost ref
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"switching mode",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain(
			"ClineProvider reference is lost",
		)
	})

	test("handleComplete should fail if target mode is invalid", async () => {
		mockToolUse.params.mode_slug = "invalid_mode"
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(getModeBySlug).toHaveBeenCalledWith("invalid_mode", [])
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "ERROR: Invalid mode: invalid_mode")
		expect(mockProviderInstance.handleModeSwitch).not.toHaveBeenCalled()
	})

	test("handleComplete should push 'Already in mode' if target mode is current mode", async () => {
		mockToolUse.params.mode_slug = "code" // Target is the current mode from mock state
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(getModeBySlug).toHaveBeenCalledWith("code", [])
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Already in Code Mode mode.")
		expect(mockProviderInstance.handleModeSwitch).not.toHaveBeenCalled()
	})

	test("handleComplete should ask approval, switch mode, push result, and delay", async () => {
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Verify state and mode check
		expect(mockProviderInstance.getState).toHaveBeenCalled()
		expect(getModeBySlug).toHaveBeenCalledWith(mockToolUse.params.mode_slug, []) // Check target
		expect(getModeBySlug).toHaveBeenCalledWith("code", []) // Check current

		// Verify approval
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			JSON.stringify({
				tool: "switchMode",
				mode: mockToolUse.params.mode_slug,
				reason: mockToolUse.params.reason,
			}),
		)

		// Verify actions
		expect(mockProviderInstance.handleModeSwitch).toHaveBeenCalledWith(mockToolUse.params.mode_slug)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Successfully switched from Code Mode mode to Ask Mode mode"),
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "switch_mode")
		expect(delay).toHaveBeenCalledWith(500)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should switch mode without reason", async () => {
		delete mockToolUse.params.reason // Remove optional reason
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			JSON.stringify({
				tool: "switchMode",
				mode: mockToolUse.params.mode_slug,
				reason: undefined, // Reason should be undefined
			}),
		)
		expect(mockProviderInstance.handleModeSwitch).toHaveBeenCalledWith(mockToolUse.params.mode_slug)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"Successfully switched from Code Mode mode to Ask Mode mode.", // No "because" part
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalled()
		expect(delay).toHaveBeenCalled()
	})

	test("handleComplete should skip actions if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockProviderInstance.handleModeSwitch).not.toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
		expect(delay).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during mode switch", async () => {
		const switchError = new Error("Failed to switch")
		mockProviderInstance.handleModeSwitch.mockRejectedValue(switchError) // Make switch throw
		const handler = new SwitchModeHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockProviderInstance.handleModeSwitch).toHaveBeenCalled()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "switching mode", switchError)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
		expect(delay).not.toHaveBeenCalled() // Error before delay
	})
})
