import * as vscode from "vscode"
import { SettingsManager, GlobalStateKey, SecretKey, SettingsChangeEvent } from "../SettingsManager"
import { HistoryItem } from "../../../shared/HistoryItem"
import { ApiConfiguration } from "../../../shared/api"
import { Mode } from "../../../shared/modes"

// Mock the logger
jest.mock("../../../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
	},
}))

// Mock vscode
jest.mock("vscode", () => ({
	EventEmitter: jest.fn().mockImplementation(() => ({
		event: jest.fn(),
		fire: jest.fn(),
	})),
	env: {
		language: "en",
	},
}))

describe("SettingsManager", () => {
	let settingsManager: SettingsManager
	let mockContext: any
	let mockEventHandler: jest.Mock

	beforeEach(() => {
		// Create mock context
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn(),
				store: jest.fn(),
				delete: jest.fn(),
			},
		}

		// Create mock event handler
		mockEventHandler = jest.fn()

		// Create SettingsManager instance
		settingsManager = new SettingsManager(mockContext as unknown as vscode.ExtensionContext)

		// Mock the event subscription
		const mockOnDidChangeSettings = jest.fn().mockImplementation((handler) => {
			mockEventHandler = handler
			return { dispose: jest.fn() }
		})

		// @ts-ignore - Mocking private property
		settingsManager["_onDidChangeSettings"].event = mockOnDidChangeSettings
	})

	describe("updateGlobalState", () => {
		it("should update global state and fire event", async () => {
			const key: GlobalStateKey = "apiProvider"
			const value = "openai"

			await settingsManager.updateGlobalState(key, value)

			expect(mockContext.globalState.update).toHaveBeenCalledWith(key, value)
			// @ts-ignore - Accessing private property for testing
			expect(settingsManager["_onDidChangeSettings"].fire).toHaveBeenCalledWith({ key, value })
		})

		it("should throw error when update fails", async () => {
			const key: GlobalStateKey = "apiProvider"
			const value = "openai"
			const error = new Error("Update failed")

			mockContext.globalState.update.mockRejectedValue(error)

			await expect(settingsManager.updateGlobalState(key, value)).rejects.toThrow(
				"Failed to update setting: apiProvider",
			)
		})
	})

	describe("getGlobalState", () => {
		it("should get global state", async () => {
			const key: GlobalStateKey = "apiProvider"
			const value = "openai"

			mockContext.globalState.get.mockReturnValue(value)

			const result = await settingsManager.getGlobalState(key)

			expect(mockContext.globalState.get).toHaveBeenCalledWith(key)
			expect(result).toBe(value)
		})

		it("should return undefined when get fails", async () => {
			const key: GlobalStateKey = "apiProvider"
			const error = new Error("Get failed")

			mockContext.globalState.get.mockImplementation(() => {
				throw error
			})

			const result = await settingsManager.getGlobalState(key)

			expect(result).toBeUndefined()
		})
	})

	describe("storeSecret", () => {
		it("should store secret", async () => {
			const key: SecretKey = "apiKey"
			const value = "test-key"

			await settingsManager.storeSecret(key, value)

			expect(mockContext.secrets.store).toHaveBeenCalledWith(key, value)
		})

		it("should delete secret when value is undefined", async () => {
			const key: SecretKey = "apiKey"

			await settingsManager.storeSecret(key, undefined)

			expect(mockContext.secrets.delete).toHaveBeenCalledWith(key)
		})

		it("should throw error when store fails", async () => {
			const key: SecretKey = "apiKey"
			const value = "test-key"
			const error = new Error("Store failed")

			mockContext.secrets.store.mockRejectedValue(error)

			await expect(settingsManager.storeSecret(key, value)).rejects.toThrow("Failed to store secret: apiKey")
		})

		it("should throw error when delete fails", async () => {
			const key: SecretKey = "apiKey"
			const error = new Error("Delete failed")

			mockContext.secrets.delete.mockRejectedValue(error)

			await expect(settingsManager.storeSecret(key, undefined)).rejects.toThrow("Failed to delete secret: apiKey")
		})
	})

	describe("getSecret", () => {
		it("should get secret", async () => {
			const key: SecretKey = "apiKey"
			const value = "test-key"

			mockContext.secrets.get.mockResolvedValue(value)

			const result = await settingsManager.getSecret(key)

			expect(mockContext.secrets.get).toHaveBeenCalledWith(key)
			expect(result).toBe(value)
		})

		it("should return undefined when get fails", async () => {
			const key: SecretKey = "apiKey"
			const error = new Error("Get failed")

			mockContext.secrets.get.mockRejectedValue(error)

			const result = await settingsManager.getSecret(key)

			expect(result).toBeUndefined()
		})
	})

	describe("getAllSettings", () => {
		beforeEach(() => {
			// Mock getGlobalState and getSecret to return test values
			jest.spyOn(settingsManager, "getGlobalState").mockImplementation((key: GlobalStateKey) => {
				const mockValues: Record<string, any> = {
					apiProvider: "openai",
					apiModelId: "gpt-4",
					mode: "code",
					soundEnabled: true,
					diffEnabled: true,
				}
				return Promise.resolve(mockValues[key])
			})

			jest.spyOn(settingsManager, "getSecret").mockImplementation((key: SecretKey) => {
				const mockValues: Record<string, string> = {
					apiKey: "test-api-key",
					openAiApiKey: "test-openai-key",
				}
				return Promise.resolve(mockValues[key])
			})
		})

		it("should get all settings with default values", async () => {
			const settings = await settingsManager.getAllSettings()

			expect(settings).toHaveProperty("apiConfiguration")
			expect(settings.apiConfiguration).toHaveProperty("apiProvider", "openai")
			expect(settings.apiConfiguration).toHaveProperty("apiModelId", "gpt-4")
			expect(settings.apiConfiguration).toHaveProperty("apiKey", "test-api-key")
			expect(settings).toHaveProperty("mode", "code")
			expect(settings).toHaveProperty("soundEnabled", true)
			expect(settings).toHaveProperty("diffEnabled", true)
			expect(settings).toHaveProperty("browserViewportSize", "900x600") // Default value
		})

		it("should use default apiProvider when not stored", async () => {
			jest.spyOn(settingsManager, "getGlobalState").mockImplementation((key: GlobalStateKey) => {
				if (key === "apiProvider") return Promise.resolve(undefined)
				return Promise.resolve(undefined)
			})

			jest.spyOn(settingsManager, "getSecret").mockImplementation((key: SecretKey) => {
				if (key === "apiKey") return Promise.resolve("test-api-key")
				return Promise.resolve(undefined)
			})

			const settings = await settingsManager.getAllSettings()

			expect(settings.apiConfiguration.apiProvider).toBe("anthropic")
		})

		it("should use openrouter as default for new users", async () => {
			jest.spyOn(settingsManager, "getGlobalState").mockImplementation(() => Promise.resolve(undefined))
			jest.spyOn(settingsManager, "getSecret").mockImplementation(() => Promise.resolve(undefined))

			const settings = await settingsManager.getAllSettings()

			expect(settings.apiConfiguration.apiProvider).toBe("openrouter")
		})
	})

	describe("updateApiConfiguration", () => {
		it("should update all API configuration settings", async () => {
			const apiConfiguration: Partial<ApiConfiguration> = {
				apiProvider: "openai",
				apiModelId: "gpt-4",
				apiKey: "test-api-key",
				openAiApiKey: "test-openai-key",
			}

			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()
			const storeSecretSpy = jest.spyOn(settingsManager, "storeSecret").mockResolvedValue()

			await settingsManager.updateApiConfiguration(apiConfiguration as ApiConfiguration)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("apiProvider", "openai")
			expect(updateGlobalStateSpy).toHaveBeenCalledWith("apiModelId", "gpt-4")
			expect(storeSecretSpy).toHaveBeenCalledWith("apiKey", "test-api-key")
			expect(storeSecretSpy).toHaveBeenCalledWith("openAiApiKey", "test-openai-key")
		})

		it("should throw error when update fails", async () => {
			const apiConfiguration: Partial<ApiConfiguration> = {
				apiProvider: "openai",
			}

			jest.spyOn(settingsManager, "updateGlobalState").mockRejectedValue(new Error("Update failed"))

			await expect(settingsManager.updateApiConfiguration(apiConfiguration as ApiConfiguration)).rejects.toThrow(
				"Failed to update API configuration",
			)
		})
	})

	describe("updateCustomInstructions", () => {
		it("should update custom instructions", async () => {
			const instructions = "Test instructions"
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			await settingsManager.updateCustomInstructions(instructions)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("customInstructions", instructions)
		})

		it("should clear custom instructions when undefined", async () => {
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			await settingsManager.updateCustomInstructions(undefined)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("customInstructions", undefined)
		})

		it("should throw error when update fails", async () => {
			jest.spyOn(settingsManager, "updateGlobalState").mockRejectedValue(new Error("Update failed"))

			await expect(settingsManager.updateCustomInstructions("Test")).rejects.toThrow(
				"Failed to update custom instructions",
			)
		})
	})

	describe("updateTaskHistory", () => {
		it("should add new item to history", async () => {
			const item: HistoryItem = {
				id: "test-id",
				task: "Test task",
				ts: Date.now(),
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue([])
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			const result = await settingsManager.updateTaskHistory(item)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("taskHistory", [item])
			expect(result).toEqual([item])
		})

		it("should update existing item in history", async () => {
			const existingItem: HistoryItem = {
				id: "test-id",
				task: "Old task",
				ts: Date.now() - 1000,
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}

			const updatedItem: HistoryItem = {
				id: "test-id",
				task: "Updated task",
				ts: Date.now(),
				tokensIn: 150,
				tokensOut: 250,
				totalCost: 0.02,
			}

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue([existingItem])
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			const result = await settingsManager.updateTaskHistory(updatedItem)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("taskHistory", [updatedItem])
			expect(result).toEqual([updatedItem])
		})

		it("should throw error when update fails", async () => {
			const item: HistoryItem = {
				id: "test-id",
				task: "Test task",
				ts: Date.now(),
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}

			jest.spyOn(settingsManager, "getGlobalState").mockRejectedValue(new Error("Get failed"))

			await expect(settingsManager.updateTaskHistory(item)).rejects.toThrow("Failed to update task history")
		})
	})

	describe("getModeApiConfig", () => {
		it("should get mode API config", async () => {
			const mode: Mode = "code"
			const configId = "test-config-id"
			const modeApiConfigs = { code: configId }

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue(modeApiConfigs)

			const result = await settingsManager.getModeApiConfig(mode)

			expect(result).toBe(configId)
		})

		it("should return undefined when mode config not found", async () => {
			const mode: Mode = "code"
			const modeApiConfigs = { chat: "other-config-id" }

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue(modeApiConfigs)

			const result = await settingsManager.getModeApiConfig(mode)

			expect(result).toBeUndefined()
		})

		it("should return undefined when get fails", async () => {
			const mode: Mode = "code"

			jest.spyOn(settingsManager, "getGlobalState").mockRejectedValue(new Error("Get failed"))

			const result = await settingsManager.getModeApiConfig(mode)

			expect(result).toBeUndefined()
		})
	})

	describe("setModeApiConfig", () => {
		it("should set mode API config when configs exist", async () => {
			const mode: Mode = "code"
			const configId = "test-config-id"
			const existingConfigs = { chat: "other-config-id" }
			const expectedConfigs = { chat: "other-config-id", code: configId }

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue(existingConfigs)
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			await settingsManager.setModeApiConfig(mode, configId)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("modeApiConfigs", expectedConfigs)
		})

		it("should set mode API config when no configs exist", async () => {
			const mode: Mode = "code"
			const configId = "test-config-id"
			const expectedConfigs = { code: configId }

			jest.spyOn(settingsManager, "getGlobalState").mockResolvedValue(undefined)
			const updateGlobalStateSpy = jest.spyOn(settingsManager, "updateGlobalState").mockResolvedValue()

			await settingsManager.setModeApiConfig(mode, configId)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("modeApiConfigs", expectedConfigs)
		})

		it("should throw error when update fails", async () => {
			const mode: Mode = "code"
			const configId = "test-config-id"

			jest.spyOn(settingsManager, "getGlobalState").mockRejectedValue(new Error("Get failed"))

			await expect(settingsManager.setModeApiConfig(mode, configId)).rejects.toThrow(
				"Failed to set mode API config for mode code",
			)
		})
	})

	describe("resetAllSettings", () => {
		it("should reset all global state keys", async () => {
			const keys = ["apiProvider", "apiModelId", "mode"]
			mockContext.globalState.keys.mockReturnValue(keys)

			await settingsManager.resetAllSettings()

			expect(mockContext.globalState.update).toHaveBeenCalledTimes(keys.length)
			keys.forEach((key) => {
				expect(mockContext.globalState.update).toHaveBeenCalledWith(key, undefined)
			})
		})

		it("should reset all secrets", async () => {
			const storeSecretSpy = jest.spyOn(settingsManager, "storeSecret").mockResolvedValue()

			await settingsManager.resetAllSettings()

			// Check that all secret keys are reset
			expect(storeSecretSpy).toHaveBeenCalledTimes(13) // Number of secret keys
			expect(storeSecretSpy).toHaveBeenCalledWith("apiKey", undefined)
			expect(storeSecretSpy).toHaveBeenCalledWith("openAiApiKey", undefined)
			// ... other secret keys
		})

		it("should throw error when reset fails", async () => {
			mockContext.globalState.keys.mockImplementation(() => {
				throw new Error("Keys failed")
			})

			await expect(settingsManager.resetAllSettings()).rejects.toThrow("Failed to reset all settings")
		})
	})
})
