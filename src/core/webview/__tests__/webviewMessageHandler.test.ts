import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import { getModels } from "../../../api/providers/fetchers/modelCache"
import { ModelRecord } from "../../../shared/api"
import type { ClineMessage } from "@roo-code/types"
import * as vscode from "vscode"

// Mock dependencies
jest.mock("../../../api/providers/fetchers/modelCache")
jest.mock("vscode", () => ({
	window: {
		showWarningMessage: jest.fn(),
	},
}))
jest.mock("../../checkpoints", () => ({
	checkpointRestore: jest.fn(),
}))

const mockGetModels = getModels as jest.MockedFunction<typeof getModels>

// Mock ClineProvider
const mockClineProvider = {
	getState: jest.fn(),
	postMessageToWebview: jest.fn(),
} as unknown as ClineProvider

describe("webviewMessageHandler - requestRouterModels", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockClineProvider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: {
				openRouterApiKey: "openrouter-key",
				requestyApiKey: "requesty-key",
				glamaApiKey: "glama-key",
				unboundApiKey: "unbound-key",
				litellmApiKey: "litellm-key",
				litellmBaseUrl: "http://localhost:4000",
			},
		})
	})

	it("successfully fetches models from all providers", async () => {
		const mockModels: ModelRecord = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Test model 1",
			},
			"model-2": {
				maxTokens: 8192,
				contextWindow: 16384,
				supportsPromptCache: false,
				description: "Test model 2",
			},
		}

		mockGetModels.mockResolvedValue(mockModels)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
		})

		// Verify getModels was called for each provider
		expect(mockGetModels).toHaveBeenCalledWith({ provider: "openrouter" })
		expect(mockGetModels).toHaveBeenCalledWith({ provider: "requesty", apiKey: "requesty-key" })
		expect(mockGetModels).toHaveBeenCalledWith({ provider: "glama" })
		expect(mockGetModels).toHaveBeenCalledWith({ provider: "unbound", apiKey: "unbound-key" })
		expect(mockGetModels).toHaveBeenCalledWith({
			provider: "litellm",
			apiKey: "litellm-key",
			baseUrl: "http://localhost:4000",
		})

		// Verify response was sent
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "routerModels",
			routerModels: {
				openrouter: mockModels,
				requesty: mockModels,
				glama: mockModels,
				unbound: mockModels,
				litellm: mockModels,
			},
		})
	})

	it("handles LiteLLM models with values from message when config is missing", async () => {
		mockClineProvider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: {
				openRouterApiKey: "openrouter-key",
				requestyApiKey: "requesty-key",
				glamaApiKey: "glama-key",
				unboundApiKey: "unbound-key",
				// Missing litellm config
			},
		})

		const mockModels: ModelRecord = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Test model 1",
			},
		}

		mockGetModels.mockResolvedValue(mockModels)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
			values: {
				litellmApiKey: "message-litellm-key",
				litellmBaseUrl: "http://message-url:4000",
			},
		})

		// Verify LiteLLM was called with values from message
		expect(mockGetModels).toHaveBeenCalledWith({
			provider: "litellm",
			apiKey: "message-litellm-key",
			baseUrl: "http://message-url:4000",
		})
	})

	it("skips LiteLLM when both config and message values are missing", async () => {
		mockClineProvider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: {
				openRouterApiKey: "openrouter-key",
				requestyApiKey: "requesty-key",
				glamaApiKey: "glama-key",
				unboundApiKey: "unbound-key",
				// Missing litellm config
			},
		})

		const mockModels: ModelRecord = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Test model 1",
			},
		}

		mockGetModels.mockResolvedValue(mockModels)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
			// No values provided
		})

		// Verify LiteLLM was NOT called
		expect(mockGetModels).not.toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "litellm",
			}),
		)

		// Verify response includes empty object for LiteLLM
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "routerModels",
			routerModels: {
				openrouter: mockModels,
				requesty: mockModels,
				glama: mockModels,
				unbound: mockModels,
				litellm: {},
			},
		})
	})

	it("handles individual provider failures gracefully", async () => {
		const mockModels: ModelRecord = {
			"model-1": {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				description: "Test model 1",
			},
		}

		// Mock some providers to succeed and others to fail
		mockGetModels
			.mockResolvedValueOnce(mockModels) // openrouter
			.mockRejectedValueOnce(new Error("Requesty API error")) // requesty
			.mockResolvedValueOnce(mockModels) // glama
			.mockRejectedValueOnce(new Error("Unbound API error")) // unbound
			.mockRejectedValueOnce(new Error("LiteLLM connection failed")) // litellm

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
		})

		// Verify successful providers are included
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "routerModels",
			routerModels: {
				openrouter: mockModels,
				requesty: {},
				glama: mockModels,
				unbound: {},
				litellm: {},
			},
		})

		// Verify error messages were sent for failed providers
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "Requesty API error",
			values: { provider: "requesty" },
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "Unbound API error",
			values: { provider: "unbound" },
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "LiteLLM connection failed",
			values: { provider: "litellm" },
		})
	})

	it("handles Error objects and string errors correctly", async () => {
		// Mock providers to fail with different error types
		mockGetModels
			.mockRejectedValueOnce(new Error("Structured error message")) // Error object
			.mockRejectedValueOnce("String error message") // String error
			.mockRejectedValueOnce({ message: "Object with message" }) // Object error
			.mockResolvedValueOnce({}) // Success
			.mockResolvedValueOnce({}) // Success

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
		})

		// Verify error handling for different error types
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "Structured error message",
			values: { provider: "openrouter" },
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "String error message",
			values: { provider: "requesty" },
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "[object Object]",
			values: { provider: "glama" },
		})
	})

	it("prefers config values over message values for LiteLLM", async () => {
		const mockModels: ModelRecord = {}
		mockGetModels.mockResolvedValue(mockModels)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestRouterModels",
			values: {
				litellmApiKey: "message-key",
				litellmBaseUrl: "http://message-url",
			},
		})

		// Verify config values are used over message values
		expect(mockGetModels).toHaveBeenCalledWith({
			provider: "litellm",
			apiKey: "litellm-key", // From config
			baseUrl: "http://localhost:4000", // From config
		})
	})
})

describe("webviewMessageHandler - editMessage", () => {
	let mockCline: any

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock Cline instance
		mockCline = {
			taskId: "test-task-id",
			clineMessages: [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
				{ ts: 2000, type: "say", say: "user_feedback", text: "Second message" },
				{ ts: 3000, type: "say", say: "checkpoint_saved", text: "Checkpoint saved" },
				{ ts: 4000, type: "say", say: "user_feedback", text: "Third message" },
			] as ClineMessage[],
			apiConversationHistory: [
				{ ts: 1000, role: "user", content: "First message" },
				{ ts: 2000, role: "user", content: "Second message" },
				{ ts: 4000, role: "user", content: "Third message" },
			],
			overwriteClineMessages: jest.fn(),
			overwriteApiConversationHistory: jest.fn(),
		}

		mockClineProvider.getCurrentCline = jest.fn().mockReturnValue(mockCline)
		mockClineProvider.getState = jest.fn().mockResolvedValue({ enableCheckpoints: true })
		mockClineProvider.getTaskWithId = jest.fn().mockResolvedValue({
			historyItem: { clineMessages: mockCline.clineMessages },
		})
		mockClineProvider.postStateToWebview = jest.fn()
		mockClineProvider.initClineWithHistoryItem = jest.fn()
	})

	it("handles basic message editing without confirmation", async () => {
		// Mock no subsequent messages and no checkpoints
		mockCline.clineMessages = [{ ts: 1000, type: "say", say: "user_feedback", text: "Only message" }]
		mockClineProvider.getState = jest.fn().mockResolvedValue({ enableCheckpoints: false })

		await webviewMessageHandler(mockClineProvider, {
			type: "editMessage",
			value: 1000,
			text: "Edited message",
		})

		expect(mockClineProvider.initClineWithHistoryItem).toHaveBeenCalled()
	})

	it("shows confirmation dialog when editing affects subsequent messages", async () => {
		const mockShowWarning = vscode.window.showWarningMessage as jest.Mock
		mockShowWarning.mockResolvedValue("Edit Message")

		await webviewMessageHandler(mockClineProvider, {
			type: "editMessage",
			value: 2000, // Edit second message, affecting third message
			text: "Edited second message",
		})

		expect(mockShowWarning).toHaveBeenCalledWith(
			"Edit and delete subsequent messages?\n\n• 1 checkpoint(s) will be removed",
			{ modal: true },
			"Edit Message",
		)
		expect(mockClineProvider.initClineWithHistoryItem).toHaveBeenCalled()
	})

	it("cancels edit when user declines confirmation", async () => {
		const mockShowWarning = vscode.window.showWarningMessage as jest.Mock
		mockShowWarning.mockResolvedValue(undefined) // User cancelled

		await webviewMessageHandler(mockClineProvider, {
			type: "editMessage",
			value: 2000,
			text: "This edit should be cancelled",
		})

		expect(mockClineProvider.postStateToWebview).toHaveBeenCalled()
		expect(mockClineProvider.initClineWithHistoryItem).not.toHaveBeenCalled()
	})

	it("handles invalid message parameters gracefully", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "editMessage",
			value: undefined, // Invalid value
			text: "Should not process",
		})

		expect(mockClineProvider.initClineWithHistoryItem).not.toHaveBeenCalled()
	})
})
