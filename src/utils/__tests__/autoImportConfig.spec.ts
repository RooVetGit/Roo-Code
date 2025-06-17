import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock dependencies
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
	readFile: vi.fn(),
}))

vi.mock("path", () => ({
	join: vi.fn((...args: string[]) => args.join("/")),
	isAbsolute: vi.fn((p: string) => p.startsWith("/")),
	basename: vi.fn((p: string) => p.split("/").pop() || ""),
}))

vi.mock("os", () => ({
	homedir: vi.fn(() => "/home/user"),
}))

vi.mock("../fs", () => ({
	fileExistsAtPath: vi.fn(),
}))

vi.mock("../../core/config/ProviderSettingsManager")
vi.mock("../../core/config/ContextProxy")
vi.mock("../../core/config/CustomModesManager")

import { autoImportConfig } from "../autoImportConfig"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../fs"

describe("autoImportConfig", () => {
	let mockProviderSettingsManager: any
	let mockContextProxy: any
	let mockCustomModesManager: any
	let mockOutputChannel: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
		}

		// Mock provider settings manager
		mockProviderSettingsManager = {
			export: vi.fn().mockResolvedValue({
				apiConfigs: {},
				modeApiConfigs: {},
				currentApiConfigName: "default",
			}),
			import: vi.fn().mockResolvedValue(undefined),
			listConfig: vi.fn().mockResolvedValue([]),
		}

		// Mock context proxy
		mockContextProxy = {
			setValues: vi.fn().mockResolvedValue(undefined),
			setValue: vi.fn().mockResolvedValue(undefined),
			setProviderSettings: vi.fn().mockResolvedValue(undefined),
		}

		// Mock custom modes manager
		mockCustomModesManager = {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
		}

		// Reset fs mock
		vi.mocked(fs.readFile).mockReset()
		vi.mocked(fileExistsAtPath).mockReset()
		vi.mocked(vscode.workspace.getConfiguration).mockReset()
		vi.mocked(vscode.window.showInformationMessage).mockReset()
		vi.mocked(vscode.window.showWarningMessage).mockReset()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should skip auto-import when no config path is specified", async () => {
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(""),
		} as any)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] No auto-import config path specified, skipping auto-import",
		)
		expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
	})

	it("should skip auto-import when config file does not exist", async () => {
		const configPath = "~/Documents/roo-config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to return false
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Checking for config file at: /home/user/Documents/roo-config.json",
		)
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Config file not found at /home/user/Documents/roo-config.json, skipping auto-import",
		)
		expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
	})

	it("should successfully import config when file exists and is valid", async () => {
		const configPath = "/absolute/path/to/config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to return true
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)

		// Mock fs.readFile to return valid config
		const mockConfig = {
			providerProfiles: {
				currentApiConfigName: "test-config",
				apiConfigs: {
					"test-config": {
						apiProvider: "anthropic",
						anthropicApiKey: "test-key",
					},
				},
				modeApiConfigs: {},
			},
			globalSettings: {
				customInstructions: "Test instructions",
			},
		}
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig) as any)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Checking for config file at: /absolute/path/to/config.json",
		)
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Successfully imported configuration from /absolute/path/to/config.json",
		)
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"RooCode configuration automatically imported from config.json",
		)
		expect(mockProviderSettingsManager.import).toHaveBeenCalled()
		expect(mockContextProxy.setValues).toHaveBeenCalled()
	})

	it("should handle invalid JSON gracefully", async () => {
		const configPath = "~/config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to return true
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)

		// Mock fs.readFile to return invalid JSON
		vi.mocked(fs.readFile).mockResolvedValue("invalid json" as any)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("[AutoImport] Failed to import configuration:"),
		)
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("Failed to auto-import RooCode configuration:"),
		)
		expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
	})

	it("should resolve home directory paths correctly", async () => {
		const configPath = "~/Documents/config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to return false (so we can check the resolved path)
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Checking for config file at: /home/user/Documents/config.json",
		)
	})

	it("should handle relative paths by resolving them to home directory", async () => {
		const configPath = "Documents/config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to return false (so we can check the resolved path)
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[AutoImport] Checking for config file at: /home/user/Documents/config.json",
		)
	})

	it("should handle file system errors gracefully", async () => {
		const configPath = "~/config.json"
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(configPath),
		} as any)

		// Mock fileExistsAtPath to throw an error
		vi.mocked(fileExistsAtPath).mockRejectedValue(new Error("File system error"))

		await autoImportConfig({
			providerSettingsManager: mockProviderSettingsManager,
			contextProxy: mockContextProxy,
			customModesManager: mockCustomModesManager,
			outputChannel: mockOutputChannel,
		})

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("[AutoImport] Unexpected error during auto-import:"),
		)
		expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
	})
})
