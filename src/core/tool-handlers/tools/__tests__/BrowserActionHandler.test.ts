import { BrowserActionHandler } from "../BrowserActionHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { BrowserSession } from "../../../../services/browser/BrowserSession" // Re-corrected path
import { BrowserAction, BrowserActionResult, browserActions } from "../../../../shared/ExtensionMessage"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../../services/browser/BrowserSession") // Corrected path for jest.mock
const MockBrowserSession = BrowserSession as jest.MockedClass<typeof BrowserSession>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text, images) => (images ? `${text} [with images]` : text)),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

describe("BrowserActionHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockBrowserSessionInstance: jest.MockedObject<BrowserSession>
	let mockToolUse: ToolUse

	const mockActionResult: BrowserActionResult = {
		logs: "Console log output",
		screenshot: "base64-screenshot-data",
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock vscode.ExtensionContext (provide minimal structure needed)
		const mockContext = {
			extensionUri: { fsPath: "/mock/extension/path" },
			// Add other properties if BrowserSession constructor uses them
		} as any // Use 'any' for simplicity, or define a partial mock type

		// Create a mock instance of BrowserSession, passing the mock context
		mockBrowserSessionInstance = new MockBrowserSession(mockContext) as jest.MockedObject<BrowserSession>

		// Correctly mock methods to match signatures (return Promises)
		// Use mockResolvedValue for async methods
		mockBrowserSessionInstance.launchBrowser.mockResolvedValue()
		mockBrowserSessionInstance.navigateToUrl.mockResolvedValue(mockActionResult)
		mockBrowserSessionInstance.click.mockResolvedValue(mockActionResult)
		mockBrowserSessionInstance.type.mockResolvedValue(mockActionResult)
		mockBrowserSessionInstance.scrollDown.mockResolvedValue(mockActionResult)
		mockBrowserSessionInstance.scrollUp.mockResolvedValue(mockActionResult)
		// Ensure the return type for closeBrowser matches BrowserActionResult or handle appropriately
		// Casting the specific return value for closeBrowser might be needed if it differs significantly
		mockBrowserSessionInstance.closeBrowser.mockResolvedValue({ logs: "Browser closed", screenshot: undefined })

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			browserSession: mockBrowserSessionInstance, // Assign the mock session instance
			ask: jest.fn(() => Promise.resolve({})), // Default ask response
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval for launch
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value), // Simple mock for removeClosingTag
		} as unknown as jest.MockedObject<Cline>

		// Reset mockToolUse for each test
		mockToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: {
				action: "launch", // Default action
				url: "https://example.com",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test.each(browserActions)("validateParams should pass for valid action '%s'", (action) => {
		mockToolUse.params = { action }
		// Add required params for specific actions
		if (action === "launch") mockToolUse.params.url = "https://test.com"
		if (action === "click") mockToolUse.params.coordinate = "{x:10, y:20}"
		if (action === "type") mockToolUse.params.text = "hello"

		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	test("validateParams should throw if action is missing or invalid", () => {
		delete mockToolUse.params.action
		let handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow(/Missing or invalid required parameter 'action'/)

		mockToolUse.params.action = "invalid_action"
		handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow(/Missing or invalid required parameter 'action'/)
	})

	test("validateParams should throw if url is missing for launch", () => {
		mockToolUse.params = { action: "launch" } // url missing
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'url' for 'launch' action.")
	})

	test("validateParams should throw if coordinate is missing for click", () => {
		mockToolUse.params = { action: "click" } // coordinate missing
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'coordinate' for 'click' action.")
	})

	test("validateParams should throw if text is missing for type", () => {
		mockToolUse.params = { action: "type" } // text missing
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'text' for 'type' action.")
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask for launch action", async () => {
		mockToolUse.partial = true
		mockToolUse.params = { action: "launch", url: "partial.com" }
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith("browser_action_launch", "partial.com", true)
		expect(mockClineInstance.say).not.toHaveBeenCalled()
	})

	test.each(["click", "type", "scroll_down", "scroll_up", "close"])(
		"handlePartial should call say for non-launch action '%s'",
		async (action) => {
			mockToolUse.partial = true
			mockToolUse.params = { action }
			if (action === "click") mockToolUse.params.coordinate = "{x:1,y:1}"
			if (action === "type") mockToolUse.params.text = "partial text"

			const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
			await handler.handle()

			expect(mockClineInstance.say).toHaveBeenCalledWith(
				"browser_action",
				expect.stringContaining(`"action":"${action}"`),
				undefined,
				true,
			)
			expect(mockClineInstance.ask).not.toHaveBeenCalled()
		},
	)

	// --- Test handleComplete ---
	test("handleComplete should ask for approval and launch browser", async () => {
		mockToolUse.params = { action: "launch", url: "https://approved.com" }
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"browser_action_launch",
			"https://approved.com",
		)
		expect(mockClineInstance.say).toHaveBeenCalledWith("browser_action_result", "") // Loading spinner
		expect(mockBrowserSessionInstance.launchBrowser).toHaveBeenCalled()
		expect(mockBrowserSessionInstance.navigateToUrl).toHaveBeenCalledWith("https://approved.com")
		expect(mockClineInstance.say).toHaveBeenCalledWith("browser_action_result", JSON.stringify(mockActionResult)) // Show result
		const expectedLaunchResultText = `The browser action 'launch' has been executed. The console logs and screenshot have been captured for your analysis.\n\nConsole logs:\n${mockActionResult.logs}\n\n(REMEMBER: if you need to proceed to using non-\`browser_action\` tools or launch a new browser, you MUST first close this browser.) [with images]`
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expectedLaunchResultText, // Expect the exact final string
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "browser_action")
	})

	test("handleComplete should skip launch if approval denied", async () => {
		mockToolUse.params = { action: "launch", url: "https://denied.com" }
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"browser_action_launch",
			"https://denied.com",
		)
		expect(mockBrowserSessionInstance.launchBrowser).not.toHaveBeenCalled()
		expect(mockBrowserSessionInstance.navigateToUrl).not.toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
	})

	test.each([
		["click", { coordinate: "{x:10, y:20}" }, "click", ["{x:10, y:20}"]],
		["type", { text: "typing test" }, "type", ["typing test"]],
		["scroll_down", {}, "scrollDown", []],
		["scroll_up", {}, "scrollUp", []],
	])("handleComplete should execute action '%s'", async (action, params, expectedMethod, methodArgs) => {
		mockToolUse.params = { action, ...params }
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"browser_action",
			expect.stringContaining(`"action":"${action}"`),
			undefined,
			false,
		)
		expect(mockBrowserSessionInstance[expectedMethod as keyof BrowserSession]).toHaveBeenCalledWith(...methodArgs)
		expect(mockClineInstance.say).toHaveBeenCalledWith("browser_action_result", JSON.stringify(mockActionResult))
		const expectedActionResultText = `The browser action '${action}' has been executed. The console logs and screenshot have been captured for your analysis.\n\nConsole logs:\n${mockActionResult.logs}\n\n(REMEMBER: if you need to proceed to using non-\`browser_action\` tools or launch a new browser, you MUST first close this browser.) [with images]`
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expectedActionResultText, // Expect the exact final string
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "browser_action")
	})

	test("handleComplete should close browser", async () => {
		mockToolUse.params = { action: "close" }
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"browser_action",
			expect.stringContaining('"action":"close"'),
			undefined,
			false,
		)
		expect(mockBrowserSessionInstance.closeBrowser).toHaveBeenCalled()
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("browser_action_result", expect.anything()) // No result display for close
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("browser has been closed"), // Specific message for close
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "browser_action")
	})

	test("handleComplete should handle errors during action execution and close browser", async () => {
		const actionError = new Error("Click failed")
		mockToolUse.params = { action: "click", coordinate: "{x:0, y:0}" }
		;(mockBrowserSessionInstance.click as jest.Mock).mockRejectedValue(actionError)
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"executing browser action 'click'",
			actionError,
		)
		// Verify browser is closed even on error
		expect(mockBrowserSessionInstance.closeBrowser).toHaveBeenCalled()
	})

	test("handleComplete should re-throw validation errors", async () => {
		mockToolUse.params = { action: "launch" } // Missing URL
		const handler = new BrowserActionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"executing browser action 'launch'",
			expect.any(Error), // Expect an error object
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain(
			"Missing required parameter 'url'",
		) // Check error message
		expect(mockBrowserSessionInstance.closeBrowser).toHaveBeenCalled() // Ensure browser closed on validation error too
	})
})
