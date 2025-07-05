// npx vitest src/core/config/__tests__/importExport.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"

import type { ProviderName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { importSettings, importSettingsFromFile, importSettingsWithFeedback, exportSettings } from "../importExport"
import { ProviderSettingsManager } from "../ProviderSettingsManager"
import { ContextProxy } from "../ContextProxy"
import { CustomModesManager } from "../CustomModesManager"
import { safeReadJson } from "../../../utils/safeReadJson"
import { safeWriteJson } from "../../../utils/safeWriteJson"

import type { Mock } from "vitest"

vi.mock("vscode", () => ({
	window: {
		showOpenDialog: vi.fn(),
		showSaveDialog: vi.fn(),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	Uri: {
		file: vi.fn((filePath) => ({ fsPath: filePath })),
	},
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		mkdir: vi.fn(),
		writeFile: vi.fn(),
		access: vi.fn(),
		constants: {
			F_OK: 0,
			R_OK: 4,
		},
	},
	readFile: vi.fn(),
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	access: vi.fn(),
	constants: {
		F_OK: 0,
		R_OK: 4,
	},
}))

vi.mock("os", () => ({
	default: {
		homedir: vi.fn(() => "/mock/home"),
	},
	homedir: vi.fn(() => "/mock/home"),
}))

vi.mock("../../../utils/safeReadJson", () => ({
	safeReadJson: vi.fn(),
}))
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
}))

describe("importExport", () => {
	let mockProviderSettingsManager: ReturnType<typeof vi.mocked<ProviderSettingsManager>>
	let mockContextProxy: ReturnType<typeof vi.mocked<ContextProxy>>
	let mockExtensionContext: ReturnType<typeof vi.mocked<vscode.ExtensionContext>>
	let mockCustomModesManager: ReturnType<typeof vi.mocked<CustomModesManager>>

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		mockProviderSettingsManager = {
			export: vi.fn(),
			import: vi.fn(),
			listConfig: vi.fn(),
		} as unknown as ReturnType<typeof vi.mocked<ProviderSettingsManager>>

		mockContextProxy = {
			setValues: vi.fn(),
			setValue: vi.fn(),
			export: vi.fn().mockImplementation(() => Promise.resolve({})),
			setProviderSettings: vi.fn(),
		} as unknown as ReturnType<typeof vi.mocked<ContextProxy>>

		mockCustomModesManager = { updateCustomMode: vi.fn() } as unknown as ReturnType<
			typeof vi.mocked<CustomModesManager>
		>

		const map = new Map<string, string>()

		mockExtensionContext = {
			secrets: {
				get: vi.fn().mockImplementation((key: string) => map.get(key)),
				store: vi.fn().mockImplementation((key: string, value: string) => map.set(key, value)),
			},
		} as unknown as ReturnType<typeof vi.mocked<vscode.ExtensionContext>>
	})

	describe("importSettings", () => {
		it("should return success: false when user cancels file selection", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue(undefined)

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result).toEqual({ success: false, error: "User cancelled file selection" })

			expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
				filters: { JSON: ["json"] },
				canSelectMany: false,
			})

			expect(safeReadJson).not.toHaveBeenCalled()
			expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
			expect(mockContextProxy.setValues).not.toHaveBeenCalled()
		})

		it("should import settings successfully from a valid file", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])

			const mockFileContent = JSON.stringify({
				providerProfiles: {
					currentApiConfigName: "test",
					apiConfigs: { test: { apiProvider: "openai" as ProviderName, apiKey: "test-key", id: "test-id" } },
				},
				globalSettings: { mode: "code", autoApprovalEnabled: true },
			})

			;(safeReadJson as Mock).mockResolvedValue(JSON.parse(mockFileContent))

			const previousProviderProfiles = {
				currentApiConfigName: "default",
				apiConfigs: { default: { apiProvider: "anthropic" as ProviderName, id: "default-id" } },
			}

			mockProviderSettingsManager.export.mockResolvedValue(previousProviderProfiles)

			mockProviderSettingsManager.listConfig.mockResolvedValue([
				{ name: "test", id: "test-id", apiProvider: "openai" as ProviderName },
				{ name: "default", id: "default-id", apiProvider: "anthropic" as ProviderName },
			])

			mockContextProxy.export.mockResolvedValue({ mode: "code" })

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result.success).toBe(true)
			expect(safeReadJson).toHaveBeenCalledWith("/mock/path/settings.json")
			expect(mockProviderSettingsManager.export).toHaveBeenCalled()

			expect(mockProviderSettingsManager.import).toHaveBeenCalledWith({
				currentApiConfigName: "test",
				apiConfigs: {
					default: { apiProvider: "anthropic" as ProviderName, id: "default-id" },
					test: { apiProvider: "openai" as ProviderName, apiKey: "test-key", id: "test-id" },
				},
				modeApiConfigs: {},
			})

			expect(mockContextProxy.setValues).toHaveBeenCalledWith({ mode: "code", autoApprovalEnabled: true })
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("currentApiConfigName", "test")

			expect(mockContextProxy.setValue).toHaveBeenCalledWith("listApiConfigMeta", [
				{ name: "test", id: "test-id", apiProvider: "openai" as ProviderName },
				{ name: "default", id: "default-id", apiProvider: "anthropic" as ProviderName },
			])
		})

		it("should return success: false when file content is invalid", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])

			// Invalid content (missing required fields).
			const mockInvalidContent = JSON.stringify({
				providerProfiles: { apiConfigs: {} },
				globalSettings: {},
			})

			;(safeReadJson as Mock).mockResolvedValue(JSON.parse(mockInvalidContent))

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result).toEqual({ success: false, error: "[providerProfiles.currentApiConfigName]: Required" })
			expect(safeReadJson).toHaveBeenCalledWith("/mock/path/settings.json")
			expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
			expect(mockContextProxy.setValues).not.toHaveBeenCalled()
		})

		it("should import settings successfully when globalSettings key is missing", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])

			const mockFileContent = JSON.stringify({
				providerProfiles: {
					currentApiConfigName: "test",
					apiConfigs: { test: { apiProvider: "openai" as ProviderName, apiKey: "test-key", id: "test-id" } },
				},
			})

			;(safeReadJson as Mock).mockResolvedValue(JSON.parse(mockFileContent))

			const previousProviderProfiles = {
				currentApiConfigName: "default",
				apiConfigs: { default: { apiProvider: "anthropic" as ProviderName, id: "default-id" } },
			}

			mockProviderSettingsManager.export.mockResolvedValue(previousProviderProfiles)

			mockProviderSettingsManager.listConfig.mockResolvedValue([
				{ name: "test", id: "test-id", apiProvider: "openai" as ProviderName },
				{ name: "default", id: "default-id", apiProvider: "anthropic" as ProviderName },
			])

			mockContextProxy.export.mockResolvedValue({ mode: "code" })

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result.success).toBe(true)
			expect(safeReadJson).toHaveBeenCalledWith("/mock/path/settings.json")
			expect(mockProviderSettingsManager.export).toHaveBeenCalled()
			expect(mockProviderSettingsManager.import).toHaveBeenCalledWith({
				currentApiConfigName: "test",
				apiConfigs: {
					default: { apiProvider: "anthropic" as ProviderName, id: "default-id" },
					test: { apiProvider: "openai" as ProviderName, apiKey: "test-key", id: "test-id" },
				},
				modeApiConfigs: {},
			})

			// Should call setValues with an empty object since globalSettings is missing.
			expect(mockContextProxy.setValues).toHaveBeenCalledWith({})
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("currentApiConfigName", "test")
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("listApiConfigMeta", [
				{ name: "test", id: "test-id", apiProvider: "openai" as ProviderName },
				{ name: "default", id: "default-id", apiProvider: "anthropic" as ProviderName },
			])
		})

		it("should return success: false when file content is not valid JSON", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])
			const jsonError = new SyntaxError("Unexpected token t in JSON at position 2")
			;(safeReadJson as Mock).mockRejectedValue(jsonError)

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result.success).toBe(false)
			expect(result.error).toMatch(/^Unexpected token t in JSON at position 2/)
			expect(safeReadJson).toHaveBeenCalledWith("/mock/path/settings.json")
			expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
			expect(mockContextProxy.setValues).not.toHaveBeenCalled()
		})

		it("should return success: false when reading file fails", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])
			;(safeReadJson as Mock).mockRejectedValue(new Error("File read error"))

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result).toEqual({ success: false, error: "File read error" })
			expect(safeReadJson).toHaveBeenCalledWith("/mock/path/settings.json")
			expect(mockProviderSettingsManager.import).not.toHaveBeenCalled()
			expect(mockContextProxy.setValues).not.toHaveBeenCalled()
		})

		it("should not clobber existing api configs", async () => {
			const providerSettingsManager = new ProviderSettingsManager(mockExtensionContext)
			await providerSettingsManager.saveConfig("openai", { apiProvider: "openai", id: "openai" })

			const configs = await providerSettingsManager.listConfig()
			expect(configs[0].name).toBe("default")
			expect(configs[1].name).toBe("openai")
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])

			const mockFileContent = JSON.stringify({
				globalSettings: { mode: "code" },
				providerProfiles: {
					currentApiConfigName: "anthropic",
					apiConfigs: { default: { apiProvider: "anthropic" as const, id: "anthropic" } },
				},
			})

			;(safeReadJson as Mock).mockResolvedValue(JSON.parse(mockFileContent))

			mockContextProxy.export.mockResolvedValue({ mode: "code" })

			const result = await importSettings({
				providerSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result.success).toBe(true)
			if (result.success && "providerProfiles" in result) {
				expect(result.providerProfiles?.apiConfigs["openai"]).toBeDefined()
				expect(result.providerProfiles?.apiConfigs["default"]).toBeDefined()
				expect(result.providerProfiles?.apiConfigs["default"].apiProvider).toBe("anthropic")
			}
		})

		it("should call updateCustomMode for each custom mode in config", async () => {
			;(vscode.window.showOpenDialog as Mock).mockResolvedValue([{ fsPath: "/mock/path/settings.json" }])

			const customModes = [
				{ slug: "mode1", name: "Mode One", roleDefinition: "Custom role one", groups: [] },
				{ slug: "mode2", name: "Mode Two", roleDefinition: "Custom role two", groups: [] },
			]

			const mockFileContent = JSON.stringify({
				providerProfiles: { currentApiConfigName: "test", apiConfigs: {} },
				globalSettings: { mode: "code", customModes },
			})

			;(safeReadJson as Mock).mockResolvedValue(JSON.parse(mockFileContent))

			mockProviderSettingsManager.export.mockResolvedValue({
				currentApiConfigName: "test",
				apiConfigs: {},
			})

			mockProviderSettingsManager.listConfig.mockResolvedValue([])

			const result = await importSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
				customModesManager: mockCustomModesManager,
			})

			expect(result.success).toBe(true)
			expect(mockCustomModesManager.updateCustomMode).toHaveBeenCalledTimes(customModes.length)

			customModes.forEach((mode) => {
				expect(mockCustomModesManager.updateCustomMode).toHaveBeenCalledWith(mode.slug, mode)
			})
		})

		it("should import settings from provided file path without showing dialog", async () => {
			const filePath = "/mock/path/settings.json"
			const mockFileData = {
				providerProfiles: {
					currentApiConfigName: "test",
					apiConfigs: { test: { apiProvider: "openai" as ProviderName, apiKey: "test-key", id: "test-id" } },
				},
				globalSettings: { mode: "code", autoApprovalEnabled: true },
			}

			;(safeReadJson as Mock).mockResolvedValue(mockFileData)
			;(fs.access as Mock).mockResolvedValue(undefined) // File exists and is readable

			const previousProviderProfiles = {
				currentApiConfigName: "default",
				apiConfigs: { default: { apiProvider: "anthropic" as ProviderName, id: "default-id" } },
			}

			mockProviderSettingsManager.export.mockResolvedValue(previousProviderProfiles)
			mockProviderSettingsManager.listConfig.mockResolvedValue([
				{ name: "test", id: "test-id", apiProvider: "openai" as ProviderName },
				{ name: "default", id: "default-id", apiProvider: "anthropic" as ProviderName },
			])
			mockContextProxy.export.mockResolvedValue({ mode: "code" })

			const result = await importSettingsFromFile(
				{
					providerSettingsManager: mockProviderSettingsManager,
					contextProxy: mockContextProxy,
					customModesManager: mockCustomModesManager,
				},
				vscode.Uri.file(filePath),
			)

			expect(vscode.window.showOpenDialog).not.toHaveBeenCalled()
			expect(safeReadJson).toHaveBeenCalledWith(filePath)
			expect(result.success).toBe(true)

			// Verify that import was called, but don't be strict about the exact object structure
			expect(mockProviderSettingsManager.import).toHaveBeenCalled()

			// Verify the key properties were included
			const importCall = mockProviderSettingsManager.import.mock.calls[0][0]
			expect(importCall.currentApiConfigName).toBe("test")
			expect(importCall.apiConfigs).toBeDefined()
			expect(importCall.apiConfigs.default).toBeDefined()
			expect(importCall.apiConfigs.test).toBeDefined()
			expect(importCall.apiConfigs.test.apiProvider).toBe("openai")
			expect(importCall.apiConfigs.test.apiKey).toBe("test-key")
			expect(mockContextProxy.setValues).toHaveBeenCalledWith({ mode: "code", autoApprovalEnabled: true })
		})

		it("should return error when provided file path does not exist", async () => {
			const filePath = "/nonexistent/path/settings.json"
			const accessError = new Error("ENOENT: no such file or directory")

			;(safeReadJson as Mock).mockRejectedValue(accessError)

			// Create a mock provider for the test
			const mockProvider = {
				settingsImportedAt: 0,
				postStateToWebview: vi.fn().mockResolvedValue(undefined),
			}

			// Mock the showErrorMessage to capture the error
			const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined)

			await importSettingsWithFeedback(
				{
					providerSettingsManager: mockProviderSettingsManager,
					contextProxy: mockContextProxy,
					customModesManager: mockCustomModesManager,
					provider: mockProvider,
				},
				filePath,
			)

			expect(vscode.window.showOpenDialog).not.toHaveBeenCalled()
			expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("errors.settings_import_failed"))

			showErrorMessageSpy.mockRestore()
		})
	})

	describe("exportSettings", () => {
		it("should not export settings when user cancels file selection", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue(undefined)

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
				filters: { JSON: ["json"] },
				defaultUri: expect.anything(),
			})

			expect(mockProviderSettingsManager.export).not.toHaveBeenCalled()
			expect(mockContextProxy.export).not.toHaveBeenCalled()
			expect(fs.writeFile).not.toHaveBeenCalled()
		})

		it("should export settings to the selected file location", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue({
				fsPath: "/mock/path/roo-code-settings.json",
			})

			const mockProviderProfiles = {
				currentApiConfigName: "test",
				apiConfigs: { test: { apiProvider: "openai" as ProviderName, id: "test-id" } },
				migrations: { rateLimitSecondsMigrated: false },
			}

			mockProviderSettingsManager.export.mockResolvedValue(mockProviderProfiles)
			const mockGlobalSettings = { mode: "code", autoApprovalEnabled: true }
			mockContextProxy.export.mockResolvedValue(mockGlobalSettings)

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
				filters: { JSON: ["json"] },
				defaultUri: expect.anything(),
			})

			expect(mockProviderSettingsManager.export).toHaveBeenCalled()
			expect(mockContextProxy.export).toHaveBeenCalled()
			expect(fs.mkdir).toHaveBeenCalledWith("/mock/path", { recursive: true })

			expect(safeWriteJson).toHaveBeenCalledWith("/mock/path/roo-code-settings.json", {
				providerProfiles: mockProviderProfiles,
				globalSettings: mockGlobalSettings,
			})
		})

		it("should include globalSettings when allowedMaxRequests is null", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue({
				fsPath: "/mock/path/roo-code-settings.json",
			})

			const mockProviderProfiles = {
				currentApiConfigName: "test",
				apiConfigs: { test: { apiProvider: "openai" as ProviderName, id: "test-id" } },
				migrations: { rateLimitSecondsMigrated: false },
			}

			mockProviderSettingsManager.export.mockResolvedValue(mockProviderProfiles)

			const mockGlobalSettings = {
				mode: "code",
				autoApprovalEnabled: true,
				allowedMaxRequests: null,
			}

			mockContextProxy.export.mockResolvedValue(mockGlobalSettings)

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(safeWriteJson).toHaveBeenCalledWith("/mock/path/roo-code-settings.json", {
				providerProfiles: mockProviderProfiles,
				globalSettings: mockGlobalSettings,
			})
		})

		it("should handle errors during the export process", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue({
				fsPath: "/mock/path/roo-code-settings.json",
			})

			mockProviderSettingsManager.export.mockResolvedValue({
				currentApiConfigName: "test",
				apiConfigs: { test: { apiProvider: "openai" as ProviderName, id: "test-id" } },
				migrations: { rateLimitSecondsMigrated: false },
			})

			mockContextProxy.export.mockResolvedValue({ mode: "code" })
			// Simulate an error during the safeWriteJson operation
			;(safeWriteJson as Mock).mockRejectedValueOnce(new Error("Safe write error"))

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(vscode.window.showSaveDialog).toHaveBeenCalled()
			expect(mockProviderSettingsManager.export).toHaveBeenCalled()
			expect(mockContextProxy.export).toHaveBeenCalled()
			expect(fs.mkdir).toHaveBeenCalledWith("/mock/path", { recursive: true })
			expect(safeWriteJson).toHaveBeenCalled() // safeWriteJson is called, but it will throw
			// The error is caught and the function exits silently.
			// Optionally, ensure no error message was shown if that's part of "silent"
			// expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
		})

		it("should handle errors during directory creation", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue({
				fsPath: "/mock/path/roo-code-settings.json",
			})

			mockProviderSettingsManager.export.mockResolvedValue({
				currentApiConfigName: "test",
				apiConfigs: { test: { apiProvider: "openai" as ProviderName, id: "test-id" } },
				migrations: { rateLimitSecondsMigrated: false },
			})

			mockContextProxy.export.mockResolvedValue({ mode: "code" })
			;(fs.mkdir as Mock).mockRejectedValue(new Error("Directory creation error"))

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(vscode.window.showSaveDialog).toHaveBeenCalled()
			expect(mockProviderSettingsManager.export).toHaveBeenCalled()
			expect(mockContextProxy.export).toHaveBeenCalled()
			expect(fs.mkdir).toHaveBeenCalled()
			expect(safeWriteJson).not.toHaveBeenCalled() // Should not be called since mkdir failed.
		})

		it("should use the correct default save location", async () => {
			;(vscode.window.showSaveDialog as Mock).mockResolvedValue(undefined)

			await exportSettings({
				providerSettingsManager: mockProviderSettingsManager,
				contextProxy: mockContextProxy,
			})

			expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
				filters: { JSON: ["json"] },
				defaultUri: expect.anything(),
			})

			expect(vscode.Uri.file).toHaveBeenCalledWith(path.join("/mock/home", "Documents", "roo-code-settings.json"))
		})
	})
})
