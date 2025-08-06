import type { Mock } from "vitest"

// Mock dependencies - must come before imports
vi.mock("../../../api/providers/fetchers/modelCache")

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"
import { getModels } from "../../../api/providers/fetchers/modelCache"
import type { ModelRecord } from "../../../shared/api"

const mockGetModels = getModels as Mock<typeof getModels>

// Mock ClineProvider
const mockClineProvider = {
	getState: vi.fn(),
	postMessageToWebview: vi.fn(),
	customModesManager: {
		getCustomModes: vi.fn(),
		deleteCustomMode: vi.fn(),
	},
	context: {
		extensionPath: "/mock/extension/path",
		globalStorageUri: { fsPath: "/mock/global/storage" },
	},
	contextProxy: {
		context: {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/global/storage" },
		},
		setValue: vi.fn(),
		getValue: vi.fn(),
	},
	log: vi.fn(),
	postStateToWebview: vi.fn(),
	getCurrentCline: vi.fn(),
	getTaskWithId: vi.fn(),
	initClineWithHistoryItem: vi.fn(),
} as unknown as ClineProvider

import { t } from "../../../i18n"

vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, args?: Record<string, any>) => {
		// For the delete confirmation with rules, we need to return the interpolated string
		if (key === "common:confirmation.delete_custom_mode_with_rules" && args) {
			return `Are you sure you want to delete this ${args.scope} mode?\n\nThis will also delete the associated rules folder at:\n${args.rulesFolderPath}`
		}
		// Return the translated value for "Yes"
		if (key === "common:answers.yes") {
			return "Yes"
		}
		// Return the translated value for "Cancel"
		if (key === "common:answers.cancel") {
			return "Cancel"
		}
		return key
	}),
}))

vi.mock("fs/promises", () => {
	const mockRm = vi.fn().mockResolvedValue(undefined)
	const mockMkdir = vi.fn().mockResolvedValue(undefined)

	return {
		default: {
			rm: mockRm,
			mkdir: mockMkdir,
		},
		rm: mockRm,
		mkdir: mockMkdir,
	}
})

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import * as fsUtils from "../../../utils/fs"
import { getWorkspacePath } from "../../../utils/path"
import { ensureSettingsDirectoryExists } from "../../../utils/globalContext"
import type { ModeConfig } from "@roo-code/types"

vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")
vi.mock("../../../utils/globalContext")

describe("webviewMessageHandler - requestLmStudioModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockClineProvider.getState = vi.fn().mockResolvedValue({
			apiConfiguration: {
				lmStudioModelId: "model-1",
				lmStudioBaseUrl: "http://localhost:1234",
			},
		})
	})

	it("successfully fetches models from LMStudio", async () => {
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
			type: "requestLmStudioModels",
		})

		expect(mockGetModels).toHaveBeenCalledWith({ provider: "lmstudio", baseUrl: "http://localhost:1234" })

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "lmStudioModels",
			lmStudioModels: mockModels,
		})
	})
})

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

describe("webviewMessageHandler - deleteCustomMode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getWorkspacePath).mockReturnValue("/mock/workspace")
		vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined)
		vi.mocked(ensureSettingsDirectoryExists).mockResolvedValue("/mock/global/storage/.roo")
	})

	it("should delete a project mode and its rules folder", async () => {
		const slug = "test-project-mode"
		const rulesFolderPath = path.join("/mock/workspace", ".roo", `rules-${slug}`)

		vi.mocked(mockClineProvider.customModesManager.getCustomModes).mockResolvedValue([
			{
				name: "Test Project Mode",
				slug,
				roleDefinition: "Test Role",
				groups: [],
				source: "project",
			} as ModeConfig,
		])
		vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(mockClineProvider.customModesManager.deleteCustomMode).mockResolvedValue(undefined)

		await webviewMessageHandler(mockClineProvider, { type: "deleteCustomMode", slug })

		// The confirmation dialog is now handled in the webview, so we don't expect showInformationMessage to be called
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		expect(mockClineProvider.customModesManager.deleteCustomMode).toHaveBeenCalledWith(slug)
		expect(fs.rm).toHaveBeenCalledWith(rulesFolderPath, { recursive: true, force: true })
	})

	it("should delete a global mode and its rules folder", async () => {
		const slug = "test-global-mode"
		const homeDir = os.homedir()
		const rulesFolderPath = path.join(homeDir, ".roo", `rules-${slug}`)

		vi.mocked(mockClineProvider.customModesManager.getCustomModes).mockResolvedValue([
			{
				name: "Test Global Mode",
				slug,
				roleDefinition: "Test Role",
				groups: [],
				source: "global",
			} as ModeConfig,
		])
		vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(mockClineProvider.customModesManager.deleteCustomMode).mockResolvedValue(undefined)

		await webviewMessageHandler(mockClineProvider, { type: "deleteCustomMode", slug })

		// The confirmation dialog is now handled in the webview, so we don't expect showInformationMessage to be called
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		expect(mockClineProvider.customModesManager.deleteCustomMode).toHaveBeenCalledWith(slug)
		expect(fs.rm).toHaveBeenCalledWith(rulesFolderPath, { recursive: true, force: true })
	})

	it("should only delete the mode when rules folder does not exist", async () => {
		const slug = "test-mode-no-rules"
		vi.mocked(mockClineProvider.customModesManager.getCustomModes).mockResolvedValue([
			{
				name: "Test Mode No Rules",
				slug,
				roleDefinition: "Test Role",
				groups: [],
				source: "project",
			} as ModeConfig,
		])
		vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValue(false)
		vi.mocked(mockClineProvider.customModesManager.deleteCustomMode).mockResolvedValue(undefined)

		await webviewMessageHandler(mockClineProvider, { type: "deleteCustomMode", slug })

		// The confirmation dialog is now handled in the webview, so we don't expect showInformationMessage to be called
		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		expect(mockClineProvider.customModesManager.deleteCustomMode).toHaveBeenCalledWith(slug)
		expect(fs.rm).not.toHaveBeenCalled()
	})

	it("should handle errors when deleting rules folder", async () => {
		const slug = "test-mode-error"
		const rulesFolderPath = path.join("/mock/workspace", ".roo", `rules-${slug}`)
		const error = new Error("Permission denied")

		vi.mocked(mockClineProvider.customModesManager.getCustomModes).mockResolvedValue([
			{
				name: "Test Mode Error",
				slug,
				roleDefinition: "Test Role",
				groups: [],
				source: "project",
			} as ModeConfig,
		])
		vi.mocked(fsUtils.fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(mockClineProvider.customModesManager.deleteCustomMode).mockResolvedValue(undefined)
		vi.mocked(fs.rm).mockRejectedValue(error)

		await webviewMessageHandler(mockClineProvider, { type: "deleteCustomMode", slug })

		expect(mockClineProvider.customModesManager.deleteCustomMode).toHaveBeenCalledWith(slug)
		expect(fs.rm).toHaveBeenCalledWith(rulesFolderPath, { recursive: true, force: true })
		// Verify error message is shown to the user
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			t("common:errors.delete_rules_folder_failed", {
				rulesFolderPath,
				error: error.message,
			}),
		)
		// No error response is sent anymore - we just continue with deletion
		expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
	})
})

describe("webviewMessageHandler - message dialog preferences", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock a current Cline instance
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue({
			taskId: "test-task-id",
			apiConversationHistory: [],
			clineMessages: [],
		} as any)
		// Reset getValue mock
		vi.mocked(mockClineProvider.contextProxy.getValue).mockReturnValue(false)
	})

	describe("deleteMessage", () => {
		it("should always show dialog for delete confirmation", async () => {
			vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue({} as any) // Mock current cline exists

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 123456789, // Changed from messageTs to value
			})

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 123456789,
			})
		})
	})

	describe("submitEditedMessage", () => {
		it("should always show dialog for edit confirmation", async () => {
			vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue({} as any) // Mock current cline exists

			await webviewMessageHandler(mockClineProvider, {
				type: "submitEditedMessage",
				value: 123456789, // messageTs as number
				editedMessageContent: "edited content", // text content in editedMessageContent field
			})

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 123456789,
				text: "edited content",
			})
		})
	})
})

describe("webviewMessageHandler - requestTaskMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock a current Cline instance with many messages
		const mockCline = {
			taskId: "test-task-id",
			apiConversationHistory: [],
			clineMessages: Array.from({ length: 150 }, (_, i) => ({
				ts: i + 1000,
				type: "say",
				say: "assistant",
				text: `Message ${i + 1}`,
				partial: false,
			})),
		}
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue(mockCline as any)
	})

	it("should return paginated messages with correct offset and limit", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 0,
			limit: 50,
		})

		expect(mockClineProvider.getCurrentCline).toHaveBeenCalled()
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: expect.arrayContaining([
				expect.objectContaining({ text: "Message 101" }), // 150 - 50 + 1
				expect.objectContaining({ text: "Message 102" }),
				// ... up to Message 150
			]),
			totalMessages: 150,
			hasMore: true,
		})

		// Verify we got exactly 50 messages
		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any
		expect(response.messages).toHaveLength(50)
		expect(response.messages[0].text).toBe("Message 101")
		expect(response.messages[49].text).toBe("Message 150")
	})

	it("should return older messages when offset is increased", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 50,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: expect.arrayContaining([
				expect.objectContaining({ text: "Message 51" }), // 150 - 50 - 50 + 1
				expect.objectContaining({ text: "Message 52" }),
				// ... up to Message 100
			]),
			totalMessages: 150,
			hasMore: true,
		})

		// Verify we got exactly 50 messages
		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any
		expect(response.messages).toHaveLength(50)
		expect(response.messages[0].text).toBe("Message 51")
		expect(response.messages[49].text).toBe("Message 100")
	})

	it("should set hasMore to false when all messages are loaded", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 100,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: expect.arrayContaining([
				expect.objectContaining({ text: "Message 1" }),
				expect.objectContaining({ text: "Message 2" }),
				// ... up to Message 50
			]),
			totalMessages: 150,
			hasMore: false, // No more messages to load
		})

		// Verify we got exactly 50 messages
		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any
		expect(response.messages).toHaveLength(50)
		expect(response.messages[0].text).toBe("Message 1")
		expect(response.messages[49].text).toBe("Message 50")
	})

	it("should handle partial page at the beginning", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 140,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: expect.arrayContaining([
				expect.objectContaining({ text: "Message 1" }),
				expect.objectContaining({ text: "Message 2" }),
				// ... up to Message 10
			]),
			totalMessages: 150,
			hasMore: false,
		})

		// Verify we got only 10 messages (the remaining ones)
		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any
		expect(response.messages).toHaveLength(10)
		expect(response.messages[0].text).toBe("Message 1")
		expect(response.messages[9].text).toBe("Message 10")
	})

	it("should handle task with fewer messages than limit", async () => {
		// Mock a current Cline with only 30 messages
		const mockCline = {
			taskId: "test-task-id",
			apiConversationHistory: [],
			clineMessages: Array.from({ length: 30 }, (_, i) => ({
				ts: i + 1000,
				type: "say",
				say: "assistant",
				text: `Message ${i + 1}`,
				partial: false,
			})),
		}
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue(mockCline as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 0,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: expect.arrayContaining([
				expect.objectContaining({ text: "Message 1" }),
				expect.objectContaining({ text: "Message 30" }),
			]),
			totalMessages: 30,
			hasMore: false, // All messages loaded in first request
		})

		// Verify we got all 30 messages
		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any
		expect(response.messages).toHaveLength(30)
	})

	it("should handle no current Cline instance", async () => {
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue(undefined)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 0,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: [],
			totalMessages: 0,
			hasMore: false,
		})
	})

	it("should handle Cline with no messages", async () => {
		const mockCline = {
			taskId: "test-task-id",
			apiConversationHistory: [],
			clineMessages: [],
		}
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue(mockCline as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 0,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: [],
			totalMessages: 0,
			hasMore: false,
		})
	})

	it("should handle offset beyond message count", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 200, // Beyond 150 messages
			limit: 50,
		})

		const call = vi.mocked(mockClineProvider.postMessageToWebview).mock.calls[0]
		const response = call?.[0] as any

		expect(response).toEqual({
			type: "taskMessagesResponse",
			messages: [],
			totalMessages: 150,
			hasMore: false,
		})
	})

	it("should handle undefined clineMessages", async () => {
		const mockCline = {
			taskId: "test-task-id",
			apiConversationHistory: [],
			clineMessages: undefined,
		}
		vi.mocked(mockClineProvider.getCurrentCline).mockReturnValue(mockCline as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestTaskMessages",
			offset: 0,
			limit: 50,
		})

		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMessagesResponse",
			messages: [],
			totalMessages: 0,
			hasMore: false,
		})
	})
})
