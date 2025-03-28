import { FetchInstructionsHandler } from "../FetchInstructionsHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { fetchInstructionsTool } from "../../../tools/fetchInstructionsTool" // Import the function to mock
import { telemetryService } from "../../../../services/telemetry/TelemetryService"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

// Mock the underlying tool function
jest.mock("../../../tools/fetchInstructionsTool")
const mockFetchInstructionsTool = fetchInstructionsTool as jest.Mock

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

describe("FetchInstructionsHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			ask: jest.fn(() => Promise.resolve({})), // Default ask response
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()), // Mocked, but fetchInstructionsTool should call it
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Mocked, but fetchInstructionsTool uses it
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value), // Simple mock
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "fetch_instructions",
			params: {
				task: "create_mcp_server",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if task is missing", () => {
		delete mockToolUse.params.task
		const handler = new FetchInstructionsHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'task'")
	})

	test("validateParams should not throw if task is present", () => {
		const handler = new FetchInstructionsHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new FetchInstructionsHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			JSON.stringify({
				tool: "fetchInstructions",
				task: mockToolUse.params.task,
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should call fetchInstructionsTool with correct arguments", async () => {
		const handler = new FetchInstructionsHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Verify fetchInstructionsTool was called
		expect(mockFetchInstructionsTool).toHaveBeenCalledTimes(1)

		// Verify the arguments passed to fetchInstructionsTool
		const callArgs = mockFetchInstructionsTool.mock.calls[0]
		expect(callArgs[0]).toBe(mockClineInstance) // First arg: Cline instance
		expect(callArgs[1]).toBe(mockToolUse) // Second arg: ToolUse block

		// Verify the helper functions passed (check they are functions)
		expect(typeof callArgs[2]).toBe("function") // askApprovalHelper wrapper
		expect(typeof callArgs[3]).toBe("function") // handleErrorHelper wrapper
		expect(typeof callArgs[4]).toBe("function") // pushToolResult wrapper

		// Optionally, test if the wrappers call the underlying Cline methods when invoked
		// Example for pushToolResult wrapper:
		const pushToolResultWrapper = callArgs[4]
		await pushToolResultWrapper("Test Result")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Test Result")

		// Verify telemetry was called
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "fetch_instructions")
	})

	test("handleComplete should call handleErrorHelper if fetchInstructionsTool throws", async () => {
		const fetchError = new Error("Fetch failed")
		mockFetchInstructionsTool.mockRejectedValue(fetchError) // Make the mocked function throw

		const handler = new FetchInstructionsHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockFetchInstructionsTool).toHaveBeenCalledTimes(1)
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"fetching instructions",
			fetchError,
		)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Error helper should handle result
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled() // Should not be called on error
	})
})
