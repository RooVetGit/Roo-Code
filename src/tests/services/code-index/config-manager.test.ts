import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeIndexConfigManager } from "../../../services/code-index/config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { RerankerProvider } from "../../../services/code-index/interfaces/reranker"

// Mock the ContextProxy
vi.mock("../../../core/config/ContextProxy")

// Mock the embeddingModels module
vi.mock("../../../shared/embeddingModels", () => ({
	getDefaultModelId: vi.fn().mockReturnValue("text-embedding-ada-002"),
	getModelDimension: vi.fn().mockReturnValue(1536),
	getModelScoreThreshold: vi.fn().mockReturnValue(0.3),
}))

describe("CodeIndexConfigManager - Reranker Configuration", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: any

	const mockGlobalState = {
		codebaseIndexEnabled: true,
		codebaseIndexQdrantUrl: "http://localhost:6333",
		codebaseIndexEmbedderProvider: "openai",
		codebaseIndexEmbedderBaseUrl: "",
		codebaseIndexEmbedderModelId: "",
		codebaseIndexSearchMinScore: undefined,
		codebaseIndexSearchMaxResults: undefined,
		// Reranker configuration
		codebaseIndexRerankerEnabled: true,
		codebaseIndexRerankerProvider: "local",
		codebaseIndexRerankerUrl: "http://localhost:8080",
		codebaseIndexRerankerModel: "ms-marco-MiniLM-L-6-v2",
		codebaseIndexRerankerTopN: 100,
		codebaseIndexRerankerTopK: 20,
		codebaseIndexRerankerTimeout: 10000,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Create mock context proxy
		mockContextProxy = {
			getGlobalState: vi.fn().mockReturnValue(mockGlobalState),
			getSecret: vi.fn().mockImplementation((key: string) => {
				const secrets: any = {
					codeIndexOpenAiKey: "test-openai-key",
					codeIndexQdrantApiKey: "test-qdrant-key",
					codebaseIndexRerankerApiKey: "test-reranker-key",
				}
				return secrets[key] || ""
			}),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
		}

		// Create config manager with mock
		configManager = new CodeIndexConfigManager(mockContextProxy as any)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("isRerankerEnabled", () => {
		it("should return true when reranker and feature are enabled", () => {
			expect(configManager.isRerankerEnabled).toBe(true)
		})

		it("should return false when reranker is disabled", () => {
			const disabledState = {
				...mockGlobalState,
				codebaseIndexRerankerEnabled: false,
			}
			mockContextProxy.getGlobalState.mockReturnValue(disabledState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.isRerankerEnabled).toBe(false)
		})

		it("should return false when feature is disabled even if reranker is enabled", () => {
			const disabledFeatureState = {
				...mockGlobalState,
				codebaseIndexEnabled: false,
			}
			mockContextProxy.getGlobalState.mockReturnValue(disabledFeatureState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.isRerankerEnabled).toBe(false)
		})

		it("should use default false when reranker enabled is undefined", () => {
			const undefinedState = {
				...mockGlobalState,
				codebaseIndexRerankerEnabled: undefined,
			}
			mockContextProxy.getGlobalState.mockReturnValue(undefinedState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.isRerankerEnabled).toBe(false)
		})
	})

	describe("getRerankerConfig", () => {
		it("should return complete reranker configuration", () => {
			const config = configManager.getRerankerConfig()

			expect(config).toEqual({
				enabled: true,
				provider: "local",
				url: "http://localhost:8080",
				apiKey: "test-reranker-key",
				model: "ms-marco-MiniLM-L-6-v2",
				topN: 100,
				topK: 20,
				timeout: 10000,
			})
		})

		it("should return config with defaults when values are undefined", () => {
			const minimalState = {
				...mockGlobalState,
				codebaseIndexRerankerEnabled: undefined,
				codebaseIndexRerankerProvider: undefined,
				codebaseIndexRerankerUrl: undefined,
				codebaseIndexRerankerModel: undefined,
				codebaseIndexRerankerTopN: undefined,
				codebaseIndexRerankerTopK: undefined,
				codebaseIndexRerankerTimeout: undefined,
			}
			mockContextProxy.getGlobalState.mockReturnValue(minimalState)
			mockContextProxy.getSecret.mockReturnValue("")
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()

			expect(config).toEqual({
				enabled: false,
				provider: "local",
				url: "http://localhost:8003", // Default value
				apiKey: "",
				model: "Qwen/Qwen3-Reranker-8B", // Default value
				topN: 100,
				topK: 20,
				timeout: 10000,
			})
		})

		it("should handle different provider types", () => {
			const providers: RerankerProvider[] = ["local", "cohere", "openai", "custom"]

			providers.forEach((provider) => {
				const providerState = {
					...mockGlobalState,
					codebaseIndexRerankerProvider: provider,
				}
				mockContextProxy.getGlobalState.mockReturnValue(providerState)
				const cm = new CodeIndexConfigManager(mockContextProxy as any)

				const config = cm.getRerankerConfig()
				expect(config.provider).toBe(provider)
			})
		})

		it("should load API key from secrets", () => {
			mockContextProxy.getSecret.mockImplementation((key: string) => {
				if (key === "codebaseIndexRerankerApiKey") {
					return "super-secret-api-key"
				}
				return ""
			})
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			expect(config.apiKey).toBe("super-secret-api-key")
		})
	})

	describe("rerankerTopN getter", () => {
		it("should return configured topN value", () => {
			expect(configManager.rerankerTopN).toBe(100)
		})

		it("should return default topN when undefined", () => {
			const undefinedState = {
				...mockGlobalState,
				codebaseIndexRerankerTopN: undefined,
			}
			mockContextProxy.getGlobalState.mockReturnValue(undefinedState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.rerankerTopN).toBe(100)
		})

		it("should handle custom topN values", () => {
			const customState = {
				...mockGlobalState,
				codebaseIndexRerankerTopN: 250,
			}
			mockContextProxy.getGlobalState.mockReturnValue(customState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.rerankerTopN).toBe(250)
		})
	})

	describe("rerankerTopK getter", () => {
		it("should return configured topK value", () => {
			expect(configManager.rerankerTopK).toBe(20)
		})

		it("should return default topK when undefined", () => {
			const undefinedState = {
				...mockGlobalState,
				codebaseIndexRerankerTopK: undefined,
			}
			mockContextProxy.getGlobalState.mockReturnValue(undefinedState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.rerankerTopK).toBe(20)
		})

		it("should handle custom topK values", () => {
			const customState = {
				...mockGlobalState,
				codebaseIndexRerankerTopK: 50,
			}
			mockContextProxy.getGlobalState.mockReturnValue(customState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.rerankerTopK).toBe(50)
		})
	})

	describe("loadConfiguration with reranker settings", () => {
		it("should load reranker configuration from storage", async () => {
			const result = await configManager.loadConfiguration()

			expect(mockContextProxy.refreshSecrets).toHaveBeenCalled()
			expect(mockContextProxy.getGlobalState).toHaveBeenCalledWith("codebaseIndexConfig")

			// Verify reranker config is loaded
			const rerankerConfig = configManager.getRerankerConfig()
			expect(rerankerConfig.enabled).toBe(true)
			expect(rerankerConfig.provider).toBe("local")
			expect(rerankerConfig.url).toBe("http://localhost:8080")
		})

		it("should handle missing reranker configuration gracefully", async () => {
			mockContextProxy.getGlobalState.mockReturnValue(null)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const result = await configManager.loadConfiguration()

			// Should use defaults
			const rerankerConfig = configManager.getRerankerConfig()
			expect(rerankerConfig.enabled).toBe(false)
			expect(rerankerConfig.provider).toBe("local")
			expect(rerankerConfig.topN).toBe(100)
			expect(rerankerConfig.topK).toBe(20)
			expect(rerankerConfig.timeout).toBe(10000)
		})
	})

	describe("configuration validation", () => {
		it("should validate reranker timeout values", () => {
			const invalidTimeoutState = {
				...mockGlobalState,
				codebaseIndexRerankerTimeout: -1000,
			}
			mockContextProxy.getGlobalState.mockReturnValue(invalidTimeoutState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			// Config manager doesn't validate negative timeout, just passes it through
			expect(config.timeout).toBe(-1000)
		})

		it("should handle zero timeout value", () => {
			const zeroTimeoutState = {
				...mockGlobalState,
				codebaseIndexRerankerTimeout: 0,
			}
			mockContextProxy.getGlobalState.mockReturnValue(zeroTimeoutState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			expect(config.timeout).toBe(0)
		})

		it("should handle string provider values correctly", () => {
			const stringProviderState = {
				...mockGlobalState,
				codebaseIndexRerankerProvider: "LOCAL", // Wrong case
			}
			mockContextProxy.getGlobalState.mockReturnValue(stringProviderState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			// Config manager passes through as-is
			expect(config.provider).toBe("LOCAL" as any)
		})
	})

	describe("integration with base config", () => {
		it("should properly integrate reranker config with base code index config", () => {
			const baseConfig = configManager.getConfig()
			const rerankerConfig = configManager.getRerankerConfig()

			// Base config should not include reranker settings
			expect(baseConfig).not.toHaveProperty("rerankerEnabled")
			expect(baseConfig).not.toHaveProperty("rerankerProvider")

			// Reranker config should be separate
			expect(rerankerConfig).toBeDefined()
			expect(rerankerConfig.enabled).toBe(true)
		})

		it("should maintain consistency between feature enabled and reranker enabled", () => {
			expect(configManager.isFeatureEnabled).toBe(true)
			expect(configManager.isRerankerEnabled).toBe(true)

			// Disable feature
			const disabledFeatureState = {
				...mockGlobalState,
				codebaseIndexEnabled: false,
			}
			mockContextProxy.getGlobalState.mockReturnValue(disabledFeatureState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			expect(configManager.isFeatureEnabled).toBe(false)
			expect(configManager.isRerankerEnabled).toBe(false) // Should also be false
		})
	})

	describe("reranker URL handling", () => {
		it("should handle URLs with different protocols", () => {
			const httpsState = {
				...mockGlobalState,
				codebaseIndexRerankerUrl: "https://secure-reranker.com:8443",
			}
			mockContextProxy.getGlobalState.mockReturnValue(httpsState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			expect(config.url).toBe("https://secure-reranker.com:8443")
		})

		it("should handle empty URL string", () => {
			const emptyUrlState = {
				...mockGlobalState,
				codebaseIndexRerankerUrl: "",
			}
			mockContextProxy.getGlobalState.mockReturnValue(emptyUrlState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			expect(config.url).toBe("")
		})
	})

	describe("reranker model handling", () => {
		it("should handle various model names", () => {
			const models = [
				"ms-marco-MiniLM-L-6-v2",
				"ms-marco-TinyBERT-L-2-v2",
				"cross-encoder/ms-marco-electra-base",
				"custom-model-v1",
			]

			models.forEach((model) => {
				const modelState = {
					...mockGlobalState,
					codebaseIndexRerankerModel: model,
				}
				mockContextProxy.getGlobalState.mockReturnValue(modelState)
				const cm = new CodeIndexConfigManager(mockContextProxy as any)

				const config = cm.getRerankerConfig()
				expect(config.model).toBe(model)
			})
		})

		it("should handle empty model string", () => {
			const emptyModelState = {
				...mockGlobalState,
				codebaseIndexRerankerModel: "",
			}
			mockContextProxy.getGlobalState.mockReturnValue(emptyModelState)
			configManager = new CodeIndexConfigManager(mockContextProxy as any)

			const config = configManager.getRerankerConfig()
			expect(config.model).toBe("")
		})
	})
})
