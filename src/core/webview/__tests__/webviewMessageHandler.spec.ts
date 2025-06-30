import type { Mock } from "vitest"

// Mock dependencies - must come before imports
vi.mock("../../../api/providers/fetchers/modelCache")
vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key), // Return the key as-is for testing
}))
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [],
	},
}))

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"
import { getModels } from "../../../api/providers/fetchers/modelCache"
import type { ModelRecord } from "../../../shared/api"
import { fileExistsAtPath } from "../../../utils/fs"
import { getWorkspacePath } from "../../../utils/path"
import * as vscode from "vscode"

const mockFileExistsAtPath = fileExistsAtPath as Mock<typeof fileExistsAtPath>
const mockGetWorkspacePath = getWorkspacePath as Mock<typeof getWorkspacePath>
const mockShowInformationMessage = vscode.window.showInformationMessage as Mock
const mockShowErrorMessage = vscode.window.showErrorMessage as Mock

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

	describe("webviewMessageHandler - deleteCustomMode", () => {
		const mockCustomModesManager = {
			getCustomModes: vi.fn(),
			deleteCustomMode: vi.fn(),
		}

		const mockContextProxy = {
			setValue: vi.fn(),
		}

		const mockProvider = {
			...mockClineProvider,
			customModesManager: mockCustomModesManager,
			contextProxy: mockContextProxy,
			postStateToWebview: vi.fn(),
		} as unknown as ClineProvider

		beforeEach(() => {
			vi.clearAllMocks()
			mockGetWorkspacePath.mockReturnValue("/test/workspace")
		})

		it("shows enhanced warning when rules folder exists", async () => {
			const testMode = {
				slug: "test-mode",
				name: "Test Mode",
				source: "project" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockFileExistsAtPath.mockResolvedValue(true)
			mockShowInformationMessage.mockResolvedValue("common:answers.yes")

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "test-mode",
			})

			// Verify rules folder check was performed
			expect(mockFileExistsAtPath).toHaveBeenCalledWith("/test/workspace/.roo/rules-test-mode")

			// Verify enhanced warning message was shown
			expect(mockShowInformationMessage).toHaveBeenCalledWith(
				"common:confirmation.delete_custom_mode_with_rules",
				{ modal: true },
				"common:answers.yes",
			)

			// Verify deletion proceeded
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("test-mode")
		})

		it("shows standard warning when rules folder does not exist", async () => {
			const testMode = {
				slug: "test-mode",
				name: "Test Mode",
				source: "global" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockFileExistsAtPath.mockResolvedValue(false)
			mockShowInformationMessage.mockResolvedValue("common:answers.yes")

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "test-mode",
			})

			// Verify standard warning message was shown
			expect(mockShowInformationMessage).toHaveBeenCalledWith(
				"common:confirmation.delete_custom_mode",
				{ modal: true },
				"common:answers.yes",
			)

			// Verify deletion proceeded
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("test-mode")
		})

		it("shows standard warning when workspace path is not available", async () => {
			const testMode = {
				slug: "test-mode",
				name: "Test Mode",
				source: "project" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockGetWorkspacePath.mockReturnValue("")
			mockShowInformationMessage.mockResolvedValue("common:answers.yes")

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "test-mode",
			})

			// Verify file check was not performed
			expect(mockFileExistsAtPath).not.toHaveBeenCalled()

			// Verify standard warning message was shown
			expect(mockShowInformationMessage).toHaveBeenCalledWith(
				"common:confirmation.delete_custom_mode",
				{ modal: true },
				"common:answers.yes",
			)
		})

		it("shows standard warning when file check fails", async () => {
			const testMode = {
				slug: "test-mode",
				name: "Test Mode",
				source: "project" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockFileExistsAtPath.mockRejectedValue(new Error("File system error"))
			mockShowInformationMessage.mockResolvedValue("common:answers.yes")

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "test-mode",
			})

			// Verify standard warning message was shown (fallback)
			expect(mockShowInformationMessage).toHaveBeenCalledWith(
				"common:confirmation.delete_custom_mode",
				{ modal: true },
				"common:answers.yes",
			)

			// Verify deletion still proceeded
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("test-mode")
		})

		it("does not delete when user cancels", async () => {
			const testMode = {
				slug: "test-mode",
				name: "Test Mode",
				source: "project" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockFileExistsAtPath.mockResolvedValue(true)
			mockShowInformationMessage.mockResolvedValue(undefined) // User cancelled

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "test-mode",
			})

			// Verify deletion was not performed
			expect(mockCustomModesManager.deleteCustomMode).not.toHaveBeenCalled()
		})

		it("shows error when mode is not found", async () => {
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "nonexistent-mode",
			})

			// Verify error message was shown
			expect(mockShowErrorMessage).toHaveBeenCalledWith("common:customModes.errors.modeNotFound")

			// Verify deletion was not attempted
			expect(mockCustomModesManager.deleteCustomMode).not.toHaveBeenCalled()
		})

		it("correctly identifies GLOBAL mode source", async () => {
			const testMode = {
				slug: "global-mode",
				name: "Global Mode",
				source: "global" as const,
			}

			mockCustomModesManager.getCustomModes.mockResolvedValue([testMode])
			mockFileExistsAtPath.mockResolvedValue(true)
			mockShowInformationMessage.mockResolvedValue("common:answers.yes")

			await webviewMessageHandler(mockProvider, {
				type: "deleteCustomMode",
				slug: "global-mode",
			})

			// Verify enhanced warning message shows GLOBAL
			expect(mockShowInformationMessage).toHaveBeenCalledWith(
				"common:confirmation.delete_custom_mode_with_rules",
				{ modal: true },
				"common:answers.yes",
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
