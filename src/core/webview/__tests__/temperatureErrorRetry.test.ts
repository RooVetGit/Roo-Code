import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ClineProvider } from "../ClineProvider"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { Task } from "../../task/Task"
import { ProviderSettings } from "@roo-code/types"
import { ClineAskResponse, WebviewMessage } from "../../../shared/WebviewMessage"
import * as vscode from "vscode"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
			update: vi.fn(),
		}),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
	},
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	Uri: {
		parse: vi.fn(),
	},
}))

// Mock other dependencies
vi.mock("../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({ id: "test-model" }),
	}),
}))

vi.mock("../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

vi.mock("../../services/marketplace", () => ({
	MarketplaceManager: vi.fn().mockImplementation(() => ({
		getCurrentItems: vi.fn().mockResolvedValue([]),
		getInstallationMetadata: vi.fn().mockResolvedValue({ project: {}, global: {} }),
	})),
}))

describe("Temperature Error Retry Integration", () => {
	let mockProvider: any
	let mockTask: any
	let mockProviderSettingsManager: any
	let mockContextProxy: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock task
		mockTask = {
			taskId: "test-task-123",
			instanceId: "instance-123",
			apiConfiguration: {
				apiProvider: "anthropic",
				modelTemperature: 0.7,
			},
			clineMessages: [],
			apiConversationHistory: [],
			overwriteClineMessages: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
			recursivelyMakeClineRequests: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
		}

		// Create mock provider settings manager
		mockProviderSettingsManager = {
			saveConfig: vi.fn().mockResolvedValue(undefined),
			listConfig: vi.fn().mockResolvedValue([{ id: "config-1", name: "default", apiProvider: "anthropic" }]),
		}

		// Create mock context proxy
		mockContextProxy = {
			getValue: vi.fn((key: string) => {
				const values: Record<string, any> = {
					currentApiConfigName: "default",
					listApiConfigMeta: [{ id: "config-1", name: "default", apiProvider: "anthropic" }],
				}
				return values[key]
			}),
			setValue: vi.fn(),
			getValues: vi.fn().mockReturnValue({
				currentApiConfigName: "default",
				listApiConfigMeta: [{ id: "config-1", name: "default", apiProvider: "anthropic" }],
			}),
		}

		// Create mock provider
		mockProvider = {
			getCurrentCline: vi.fn().mockReturnValue(mockTask),
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: {
					apiProvider: "anthropic",
					modelTemperature: 0.7,
				},
				currentApiConfigName: "default",
			}),
			upsertProviderProfile: vi.fn().mockImplementation(async () => {
				// Simulate the internal call to postStateToWebview
				await mockProvider.postStateToWebview()
				return "config-1"
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			log: vi.fn(),
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should handle temperature error retry flow correctly", async () => {
		// Setup: Add a temperature error message to the task
		mockTask.clineMessages = [
			{
				ts: Date.now() - 2000,
				type: "say",
				say: "assistant",
				text: "I'll help you with that.",
			},
			{
				ts: Date.now() - 1000,
				type: "ask",
				ask: "temperature_tool_error",
				text: "It looks like the tool failed due to your current temperature setting (0.7).",
			},
		]

		// Setup: Add conversation history with user message
		mockTask.apiConversationHistory = [
			{
				role: "user",
				content: "Please write a function to calculate fibonacci numbers",
			},
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I'll write a fibonacci function for you.",
					},
					{
						type: "tool_use",
						id: "tool-123",
						name: "write_to_file",
						input: {
							path: "fibonacci.js",
							content: "function fibonacci(n) {\n  // ... rest of code unchanged\n}",
						},
					},
				],
			},
		]

		// Simulate user clicking "Reduce Temperature to 0.2 & Retry"
		const message: WebviewMessage = {
			type: "askResponse",
			askResponse: "yesButtonClicked" as ClineAskResponse,
		}

		// Execute the handler
		await webviewMessageHandler(mockProvider, message)

		// Verify temperature was updated
		expect(mockProvider.upsertProviderProfile).toHaveBeenCalledWith(
			"default",
			expect.objectContaining({
				apiProvider: "anthropic",
				modelTemperature: 0.2,
			}),
		)

		// Verify messages were removed
		expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([
			{
				ts: expect.any(Number),
				type: "say",
				say: "assistant",
				text: "I'll help you with that.",
			},
		])

		// Verify API conversation history was trimmed
		expect(mockTask.overwriteApiConversationHistory).toHaveBeenCalledWith([
			{
				role: "user",
				content: "Please write a function to calculate fibonacci numbers",
			},
		])

		// Verify the request was retried
		expect(mockTask.recursivelyMakeClineRequests).toHaveBeenCalledWith([
			{
				type: "text",
				text: "Please write a function to calculate fibonacci numbers",
			},
		])

		// Verify state was posted to webview
		expect(mockProvider.postStateToWebview).toHaveBeenCalled()
	})

	it("should handle cancel button click without making changes", async () => {
		// Setup: Add a temperature error message
		mockTask.clineMessages = [
			{
				ts: Date.now(),
				type: "ask",
				ask: "temperature_tool_error",
				text: "Temperature error detected",
			},
		]

		// Simulate user clicking cancel
		const message: WebviewMessage = {
			type: "askResponse",
			askResponse: "noButtonClicked" as ClineAskResponse,
		}

		// Execute the handler
		await webviewMessageHandler(mockProvider, message)

		// Verify no temperature update was made
		expect(mockProvider.upsertProviderProfile).not.toHaveBeenCalled()

		// Verify no messages were removed
		expect(mockTask.overwriteClineMessages).not.toHaveBeenCalled()
		expect(mockTask.overwriteApiConversationHistory).not.toHaveBeenCalled()

		// Verify no retry was attempted
		expect(mockTask.recursivelyMakeClineRequests).not.toHaveBeenCalled()
	})

	it("should handle complex content blocks correctly", async () => {
		// Setup: Add conversation history with complex content blocks
		mockTask.apiConversationHistory = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Here's an image to analyze:",
					},
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "base64data...",
						},
					},
					{
						type: "text",
						text: "Please describe what you see.",
					},
				],
			},
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-456",
						name: "write_to_file",
						input: {
							path: "description.txt",
							content: "The image shows... [rest of content]",
						},
					},
				],
			},
		]

		mockTask.clineMessages = [
			{
				ts: Date.now(),
				type: "ask",
				ask: "temperature_tool_error",
				text: "Temperature error",
			},
		]

		// Simulate retry
		const message: WebviewMessage = {
			type: "askResponse",
			askResponse: "yesButtonClicked" as ClineAskResponse,
		}

		await webviewMessageHandler(mockProvider, message)

		// Verify the content blocks were properly converted
		expect(mockTask.recursivelyMakeClineRequests).toHaveBeenCalledWith([
			{
				type: "text",
				text: "Here's an image to analyze:",
			},
			{
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: "base64data...",
				},
			},
			{
				type: "text",
				text: "Please describe what you see.",
			},
		])
	})

	it("should not trigger temperature retry for non-temperature errors", async () => {
		// Setup: Add a different type of error message
		mockTask.clineMessages = [
			{
				ts: Date.now(),
				type: "ask",
				ask: "tool",
				text: "Regular tool error",
			},
		]

		// Simulate user response
		const message: WebviewMessage = {
			type: "askResponse",
			askResponse: "yesButtonClicked" as ClineAskResponse,
		}

		// Mock the regular ask response handler
		mockTask.handleWebviewAskResponse = vi.fn()
		mockProvider.getCurrentCline.mockReturnValue(mockTask)

		await webviewMessageHandler(mockProvider, message)

		// Verify temperature update was NOT called
		expect(mockProvider.upsertProviderProfile).not.toHaveBeenCalled()

		// Verify regular handler was called instead
		expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledWith("yesButtonClicked", undefined, undefined)
	})
})
