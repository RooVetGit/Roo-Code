import type { Mock } from "vitest"
import * as vscode from "vscode"

// Mock dependencies - must come before imports
vi.mock("../../../api/providers/fetchers/modelCache")
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		instance: {
			shareTask: vi.fn(),
		},
	},
}))

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	env: {
		clipboard: {
			writeText: vi.fn(),
		},
	},
	workspace: {
		workspaceFolders: [],
	},
}))

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"
import { getModels } from "../../../api/providers/fetchers/modelCache"
import type { ModelRecord } from "../../../shared/api"
import { CloudService } from "@roo-code/cloud"

const mockGetModels = getModels as Mock<typeof getModels>

// Mock ClineProvider
const mockClineProvider = {
	getState: vi.fn(),
	postMessageToWebview: vi.fn(),
} as unknown as ClineProvider

describe("webviewMessageHandler - requestRouterModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockClineProvider.getState = vi.fn().mockResolvedValue({
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
				ollama: {},
				lmstudio: {},
			},
		})
	})

	it("handles LiteLLM models with values from message when config is missing", async () => {
		mockClineProvider.getState = vi.fn().mockResolvedValue({
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
		mockClineProvider.getState = vi.fn().mockResolvedValue({
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
				ollama: {},
				lmstudio: {},
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
				ollama: {},
				lmstudio: {},
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
			.mockRejectedValueOnce(new Error("Structured error message")) // openrouter
			.mockRejectedValueOnce(new Error("Requesty API error")) // requesty
			.mockRejectedValueOnce(new Error("Glama API error")) // glama
			.mockRejectedValueOnce(new Error("Unbound API error")) // unbound
			.mockRejectedValueOnce(new Error("LiteLLM connection failed")) // litellm

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
			error: "Requesty API error",
			values: { provider: "requesty" },
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: "Glama API error",
			values: { provider: "glama" },
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

	describe("webviewMessageHandler - shareCurrentTask", () => {
		const mockShareClineProvider = {
			getCurrentCline: vi.fn(),
			postMessageToWebview: vi.fn(),
			log: vi.fn(),
		} as unknown as ClineProvider

		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("copies share URL to clipboard on successful share", async () => {
			const mockTaskId = "test-task-id"
			const mockShareUrl = "https://roo-code.com/share/test-task-id"
			const mockClineMessages = [{ type: "say", say: "user_feedback", text: "test message" }]

			// Mock getCurrentCline to return a task with ID and messages
			mockShareClineProvider.getCurrentCline = vi.fn().mockReturnValue({
				taskId: mockTaskId,
				clineMessages: mockClineMessages,
			})

			// Mock CloudService.instance.shareTask to return success
			vi.mocked(CloudService.instance.shareTask).mockResolvedValue({
				success: true,
				shareUrl: mockShareUrl,
			})

			await webviewMessageHandler(mockShareClineProvider, {
				type: "shareCurrentTask",
				visibility: "organization",
			})

			// Verify clipboard.writeText was called with the share URL
			expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(mockShareUrl)

			// Verify success notification was shown
			expect(vscode.window.showInformationMessage).toHaveBeenCalled()

			// Verify webview message was sent
			expect(mockShareClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "shareTaskSuccess",
				visibility: "organization",
				text: mockShareUrl,
			})

			// Verify CloudService.shareTask was called with correct parameters
			expect(CloudService.instance.shareTask).toHaveBeenCalledWith(mockTaskId, "organization", mockClineMessages)
		})

		it("does not copy to clipboard when share fails", async () => {
			const mockTaskId = "test-task-id"
			const mockClineMessages = [{ type: "say", say: "user_feedback", text: "test message" }]

			// Mock getCurrentCline to return a task with ID and messages
			mockShareClineProvider.getCurrentCline = vi.fn().mockReturnValue({
				taskId: mockTaskId,
				clineMessages: mockClineMessages,
			})

			// Mock CloudService.instance.shareTask to return failure
			vi.mocked(CloudService.instance.shareTask).mockResolvedValue({
				success: false,
				error: "Authentication failed",
			})

			await webviewMessageHandler(mockShareClineProvider, {
				type: "shareCurrentTask",
				visibility: "public",
			})

			// Verify clipboard.writeText was NOT called
			expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled()

			// Verify error notification was shown
			expect(vscode.window.showErrorMessage).toHaveBeenCalled()

			// Verify no success webview message was sent
			expect(mockShareClineProvider.postMessageToWebview).not.toHaveBeenCalledWith(
				expect.objectContaining({
					type: "shareTaskSuccess",
				}),
			)
		})

		it("shows error when no active task", async () => {
			// Mock getCurrentCline to return null (no active task)
			mockShareClineProvider.getCurrentCline = vi.fn().mockReturnValue(null)

			await webviewMessageHandler(mockShareClineProvider, {
				type: "shareCurrentTask",
				visibility: "organization",
			})

			// Verify clipboard.writeText was NOT called
			expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled()

			// Verify error notification was shown
			expect(vscode.window.showErrorMessage).toHaveBeenCalled()

			// Verify CloudService.shareTask was NOT called
			expect(CloudService.instance.shareTask).not.toHaveBeenCalled()
		})

		it("handles CloudService exceptions gracefully", async () => {
			const mockTaskId = "test-task-id"
			const mockClineMessages = [{ type: "say", say: "user_feedback", text: "test message" }]

			// Mock getCurrentCline to return a task with ID and messages
			mockShareClineProvider.getCurrentCline = vi.fn().mockReturnValue({
				taskId: mockTaskId,
				clineMessages: mockClineMessages,
			})

			// Mock CloudService.instance.shareTask to throw an exception
			vi.mocked(CloudService.instance.shareTask).mockRejectedValue(new Error("Network error"))

			await webviewMessageHandler(mockShareClineProvider, {
				type: "shareCurrentTask",
				visibility: "organization",
			})

			// Verify clipboard.writeText was NOT called
			expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled()

			// Verify error notification was shown
			expect(vscode.window.showErrorMessage).toHaveBeenCalled()

			// Verify error was logged
			expect(mockShareClineProvider.log).toHaveBeenCalledWith(
				expect.stringContaining("[shareCurrentTask] Unexpected error:"),
			)
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
