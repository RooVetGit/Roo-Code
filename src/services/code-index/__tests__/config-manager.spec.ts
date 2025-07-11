// npx vitest services/code-index/__tests__/config-manager.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { PreviousConfigSnapshot } from "../interfaces/config"

// Mock ContextProxy
vi.mock("../../../core/config/ContextProxy")

describe("CodeIndexConfigManager", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup mock ContextProxy
		mockContextProxy = {
			getGlobalState: vi.fn(),
			updateGlobalState: vi.fn(),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
			getSecret: vi.fn(),
		}

		// Create a new instance for each test
		configManager = new CodeIndexConfigManager(mockContextProxy)
	})

	describe("isFeatureEnabled", () => {
		it("should return false when codebaseIndexEnabled is false", async () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			// Re-create instance to load the configuration
			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFeatureEnabled).toBe(false)
		})

		it("should return true when codebaseIndexEnabled is true", async () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			// Re-create instance to load the configuration
			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFeatureEnabled).toBe(true)
		})

		it("should default to true when codebaseIndexEnabled is not set", async () => {
			mockContextProxy.getGlobalState.mockReturnValue({})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			// Re-create instance to load the configuration
			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isFeatureEnabled).toBe(true)
		})
	})

	describe("isConfigured", () => {
		it("should return true when OpenAI provider is properly configured", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			configManager = new CodeIndexConfigManager(mockContextProxy)

			expect(configManager.isConfigured()).toBe(true)
		})

		it("should return false when OpenAI provider is missing API key", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			configManager = new CodeIndexConfigManager(mockContextProxy)

			expect(configManager.isConfigured()).toBe(false)
		})

		it("should return false when OpenAI provider is missing Qdrant URL", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			configManager = new CodeIndexConfigManager(mockContextProxy)

			expect(configManager.isConfigured()).toBe(false)
		})
	})

	describe("doesConfigChangeRequireRestart", () => {
		it("should return true when enabling the feature", async () => {
			// Initial state: disabled
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)
			configManager = new CodeIndexConfigManager(mockContextProxy)

			// Get the initial snapshot
			const { configSnapshot: previousSnapshot } = await configManager.loadConfiguration()

			// Update the internal state to enabled with proper configuration
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			// Load the new configuration - this will internally call doesConfigChangeRequireRestart
			const { requiresRestart } = await configManager.loadConfiguration()

			expect(requiresRestart).toBe(true)
		})

		it("should return true when disabling the feature", async () => {
			// Initial state: enabled and configured
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})
			configManager = new CodeIndexConfigManager(mockContextProxy)

			const previousSnapshot: PreviousConfigSnapshot = {
				enabled: true,
				configured: true,
				embedderProvider: "openai",
				openAiKey: "test-key",
				qdrantUrl: "http://localhost:6333",
			}

			// Update to disabled
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			await configManager.loadConfiguration()

			const result = configManager.doesConfigChangeRequireRestart(previousSnapshot)
			expect(result).toBe(true)
		})

		it("should return false when enabled state does not change (both enabled)", async () => {
			// Initial state: enabled and configured
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})
			configManager = new CodeIndexConfigManager(mockContextProxy)

			// Get initial configuration
			const { configSnapshot: previousSnapshot } = await configManager.loadConfiguration()

			// Load again with same config - should not require restart
			const { requiresRestart } = await configManager.loadConfiguration()

			expect(requiresRestart).toBe(false)
		})

		it("should return false when enabled state does not change (both disabled)", async () => {
			// Initial state: disabled
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)
			configManager = new CodeIndexConfigManager(mockContextProxy)

			const previousSnapshot: PreviousConfigSnapshot = {
				enabled: false,
				configured: false,
				embedderProvider: "openai",
			}

			// Same config, still disabled
			const result = configManager.doesConfigChangeRequireRestart(previousSnapshot)
			expect(result).toBe(false)
		})

		it("should return true when provider changes while enabled", async () => {
			// Initial state: enabled with openai
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "ollama",
				codebaseIndexOllamaBaseUrl: "http://localhost:11434",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)
			configManager = new CodeIndexConfigManager(mockContextProxy)

			const previousSnapshot: PreviousConfigSnapshot = {
				enabled: true,
				configured: true,
				embedderProvider: "openai",
				openAiKey: "test-key",
				qdrantUrl: "http://localhost:6333",
			}

			const result = configManager.doesConfigChangeRequireRestart(previousSnapshot)
			expect(result).toBe(true)
		})

		it("should return false when provider changes while disabled", async () => {
			// Initial state: disabled with openai
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
				codebaseIndexEmbedderProvider: "ollama",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)
			configManager = new CodeIndexConfigManager(mockContextProxy)

			const previousSnapshot: PreviousConfigSnapshot = {
				enabled: false,
				configured: false,
				embedderProvider: "openai",
			}

			// Provider changed but feature is disabled
			const result = configManager.doesConfigChangeRequireRestart(previousSnapshot)
			expect(result).toBe(false)
		})
	})

	describe("loadConfiguration", () => {
		it("should load configuration and return proper structure", async () => {
			const mockConfigValues = {
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexEmbedderModelId: "text-embedding-ada-002",
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexSearchMinScore: 0.5,
				codebaseIndexSearchMaxResults: 20,
			}

			mockContextProxy.getGlobalState.mockReturnValue(mockConfigValues)
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				if (key === "codeIndexQdrantApiKey") return "qdrant-key"
				return undefined
			})

			const result = await configManager.loadConfiguration()

			// Verify the structure
			expect(result).toHaveProperty("configSnapshot")
			expect(result).toHaveProperty("currentConfig")
			expect(result).toHaveProperty("requiresRestart")

			// Verify current config reflects loaded values
			expect(result.currentConfig.embedderProvider).toBe("openai")
			expect(result.currentConfig.isConfigured).toBe(true)
		})

		it("should detect restart requirement when configuration changes", async () => {
			// Initial state: disabled
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: false,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)
			configManager = new CodeIndexConfigManager(mockContextProxy)

			// Get initial state
			await configManager.loadConfiguration()

			// Change to enabled with proper configuration
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			const result = await configManager.loadConfiguration()
			expect(result.requiresRestart).toBe(true)
		})
	})

	describe("getConfig", () => {
		it("should return the current configuration", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			configManager = new CodeIndexConfigManager(mockContextProxy)
			const config = configManager.getConfig()

			expect(config).toHaveProperty("isConfigured")
			expect(config).toHaveProperty("embedderProvider")
			expect(config.embedderProvider).toBe("openai")
		})
	})

	describe("isConfigured", () => {
		it("should return true when OpenAI provider is properly configured", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isConfigured()).toBe(true)
		})

		it("should return false when OpenAI provider is missing API key", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isConfigured()).toBe(false)
		})

		it("should return true when Ollama provider is properly configured", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "ollama",
				codebaseIndexEmbedderBaseUrl: "http://localhost:11434",
				codebaseIndexQdrantUrl: "http://localhost:6333",
			})
			mockContextProxy.getSecret.mockReturnValue(undefined)

			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isConfigured()).toBe(true)
		})

		it("should return false when Qdrant URL is missing", () => {
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexEmbedderProvider: "openai",
			})
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			})

			configManager = new CodeIndexConfigManager(mockContextProxy)
			expect(configManager.isConfigured()).toBe(false)
		})
	})
})
