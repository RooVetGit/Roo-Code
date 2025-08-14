import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import { describe, it, expect, beforeEach, vi } from "vitest"

import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import { buildApiHandler } from "../../../api"
import type { ProviderSettings } from "@roo-code/types"

// Mock dependencies
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockImplementation((config) => ({
		getModel: () => ({ id: config.apiModelId || "gemini-1.5-pro" }),
		createMessage: vi.fn(),
	})),
}))

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation(function (this: any, options: any) {
		this.api = options.apiConfiguration ? buildApiHandler(options.apiConfiguration) : null
		this.apiConfiguration = options.apiConfiguration
		this.taskId = "test-task-id"
		this.providerRef = { deref: () => options.provider }
	}),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			setProvider: vi.fn(),
		},
		hasInstance: () => true,
		createInstance: vi.fn(),
	},
}))

vi.mock("../../config/ProviderSettingsManager", () => ({
	ProviderSettingsManager: vi.fn().mockImplementation(() => ({
		saveConfig: vi.fn().mockResolvedValue("config-id"),
		listConfig: vi.fn().mockResolvedValue([]),
		setModeConfig: vi.fn().mockResolvedValue(undefined),
		getModeConfigId: vi.fn().mockResolvedValue(undefined),
		activateProfile: vi.fn().mockResolvedValue({
			name: "test-profile",
			id: "test-id",
			apiProvider: "gemini",
		}),
	})),
}))

vi.mock("../../config/CustomModesManager", () => ({
	CustomModesManager: vi.fn().mockImplementation(() => ({
		getCustomModes: vi.fn().mockResolvedValue([]),
	})),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue(undefined),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../../../services/marketplace", () => ({
	MarketplaceManager: vi.fn().mockImplementation(() => ({
		cleanup: vi.fn(),
	})),
}))

describe("ClineProvider - Gemini API Key Update", () => {
	let provider: ClineProvider
	let mockExtensionContext: vscode.ExtensionContext
	let mockOutputChannel: any
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation(() => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation(() => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock context proxy
		mockContextProxy = new ContextProxy(mockExtensionContext)
		mockContextProxy.setProviderSettings = vi.fn().mockResolvedValue(undefined)
		mockContextProxy.setValue = vi.fn().mockResolvedValue(undefined)
		mockContextProxy.getValues = vi.fn().mockReturnValue({
			mode: "code",
			listApiConfigMeta: [],
		})
		mockContextProxy.getProviderSettings = vi.fn().mockReturnValue({
			apiProvider: "gemini",
			geminiApiKey: "old-key",
			apiModelId: "gemini-1.5-pro",
		})

		// Create provider instance
		provider = new ClineProvider(mockExtensionContext, mockOutputChannel, "sidebar", mockContextProxy)

		// Mock provider methods
		provider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		provider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		provider.getState = vi.fn().mockResolvedValue({
			mode: "code",
			apiConfiguration: {
				apiProvider: "gemini",
				geminiApiKey: "old-key",
				apiModelId: "gemini-1.5-pro",
			},
		})
		// Use public method instead of private one
		provider.setValue = vi.fn().mockResolvedValue(undefined)
	})

	it("should update task API handler when Gemini API key is changed", async () => {
		// Create a mock task
		const mockTask = new Task({
			provider,
			apiConfiguration: {
				apiProvider: "gemini",
				geminiApiKey: "old-key",
				apiModelId: "gemini-1.5-pro",
			},
			task: "test task",
		}) as any

		// Add the task to the provider's stack
		provider["clineStack"] = [mockTask]

		// Prepare new provider settings with updated API key
		const newProviderSettings: ProviderSettings = {
			apiProvider: "gemini",
			geminiApiKey: "new-key",
			apiModelId: "gemini-1.5-pro",
		}

		// Call upsertProviderProfile with the new settings
		await provider.upsertProviderProfile("test-profile", newProviderSettings, true)

		// Verify that buildApiHandler was called with the new settings
		expect(buildApiHandler).toHaveBeenCalledWith(newProviderSettings)

		// Verify that the task's API handler was updated
		expect(mockTask.api).toBeDefined()
		expect(mockTask.apiConfiguration).toEqual(newProviderSettings)

		// Verify that context proxy was updated with new settings
		expect(mockContextProxy.setProviderSettings).toHaveBeenCalledWith(newProviderSettings)
	})

	it("should update task API configuration when activating a different profile", async () => {
		// Create a mock task with initial configuration
		const mockTask = new Task({
			provider,
			apiConfiguration: {
				apiProvider: "gemini",
				geminiApiKey: "initial-key",
				apiModelId: "gemini-1.5-pro",
			},
			task: "test task",
		}) as any

		// Add the task to the provider's stack
		provider["clineStack"] = [mockTask]

		// Mock the provider settings manager's activateProfile method
		const newProviderSettings = {
			apiProvider: "gemini" as const,
			geminiApiKey: "activated-key",
			apiModelId: "gemini-1.5-flash",
		}

		provider["providerSettingsManager"].activateProfile = vi.fn().mockResolvedValue({
			name: "activated-profile",
			id: "activated-id",
			...newProviderSettings,
		})

		// Call activateProviderProfile
		await provider.activateProviderProfile({ name: "activated-profile" })

		// Verify that buildApiHandler was called with the activated settings
		expect(buildApiHandler).toHaveBeenCalledWith(newProviderSettings)

		// Verify that the task's API handler and configuration were updated
		expect(mockTask.api).toBeDefined()
		expect(mockTask.apiConfiguration).toEqual(newProviderSettings)

		// Verify that context proxy was updated
		expect(mockContextProxy.setProviderSettings).toHaveBeenCalledWith(newProviderSettings)
	})

	it("should not update API handler when activate is false", async () => {
		// Create a mock task
		const mockTask = new Task({
			provider,
			apiConfiguration: {
				apiProvider: "gemini",
				geminiApiKey: "old-key",
				apiModelId: "gemini-1.5-pro",
			},
			task: "test task",
		}) as any

		const originalApi = mockTask.api
		const originalConfig = mockTask.apiConfiguration

		// Add the task to the provider's stack
		provider["clineStack"] = [mockTask]

		// Prepare new provider settings
		const newProviderSettings: ProviderSettings = {
			apiProvider: "gemini",
			geminiApiKey: "new-key",
			apiModelId: "gemini-1.5-pro",
		}

		// Call upsertProviderProfile with activate = false
		await provider.upsertProviderProfile("test-profile", newProviderSettings, false)

		// Verify that the task's API handler was NOT updated
		expect(mockTask.api).toBe(originalApi)
		expect(mockTask.apiConfiguration).toBe(originalConfig)

		// Verify that context proxy was NOT updated
		expect(mockContextProxy.setProviderSettings).not.toHaveBeenCalled()
	})

	it("should handle case when no task is active", async () => {
		// Ensure no task is in the stack
		provider["clineStack"] = []

		// Prepare new provider settings
		const newProviderSettings: ProviderSettings = {
			apiProvider: "gemini",
			geminiApiKey: "new-key",
			apiModelId: "gemini-1.5-pro",
		}

		// Call upsertProviderProfile - should not throw
		await expect(provider.upsertProviderProfile("test-profile", newProviderSettings, true)).resolves.toBeDefined()

		// Verify that buildApiHandler was still called (for potential future tasks)
		expect(buildApiHandler).toHaveBeenCalledWith(newProviderSettings)

		// Verify that context proxy was updated
		expect(mockContextProxy.setProviderSettings).toHaveBeenCalledWith(newProviderSettings)
	})

	it("should preserve other provider settings when updating Gemini API key", async () => {
		// Create a mock task with additional settings
		const initialConfig = {
			apiProvider: "gemini" as const,
			geminiApiKey: "old-key",
			apiModelId: "gemini-1.5-pro",
			geminiBaseUrl: "https://custom.gemini.api",
			temperature: 0.7,
			maxTokens: 4096,
		}

		const mockTask = new Task({
			provider,
			apiConfiguration: initialConfig,
			task: "test task",
		}) as any

		// Add the task to the provider's stack
		provider["clineStack"] = [mockTask]

		// Update only the API key, preserving other settings
		const newProviderSettings: ProviderSettings = {
			...initialConfig,
			geminiApiKey: "new-key",
		}

		// Call upsertProviderProfile
		await provider.upsertProviderProfile("test-profile", newProviderSettings, true)

		// Verify that all settings are preserved except the API key
		expect(mockTask.apiConfiguration).toEqual({
			apiProvider: "gemini",
			geminiApiKey: "new-key",
			apiModelId: "gemini-1.5-pro",
			geminiBaseUrl: "https://custom.gemini.api",
			temperature: 0.7,
			maxTokens: 4096,
		})
	})
})
