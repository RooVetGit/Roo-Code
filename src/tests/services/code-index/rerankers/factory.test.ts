import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RerankerFactory } from "../../../../services/code-index/rerankers/factory"
import { LocalReranker } from "../../../../services/code-index/rerankers/local"
import { RerankerConfig } from "../../../../services/code-index/interfaces/reranker"

// Mock the LocalReranker
vi.mock("../../../../services/code-index/rerankers/local")

describe("RerankerFactory", () => {
	const mockValidConfig: RerankerConfig = {
		enabled: true,
		provider: "local",
		url: "http://localhost:8080",
		apiKey: "test-api-key",
		model: "test-model",
		topN: 100,
		topK: 20,
		timeout: 30000,
	}

	let consoleLogSpy: any
	let consoleWarnSpy: any
	let consoleErrorSpy: any

	beforeEach(() => {
		vi.clearAllMocks()
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleWarnSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe("create", () => {
		it("should return undefined when reranking is disabled", async () => {
			const disabledConfig = { ...mockValidConfig, enabled: false }

			const result = await RerankerFactory.create(disabledConfig)

			expect(result).toBeUndefined()
			expect(consoleLogSpy).toHaveBeenCalledWith("Reranking is disabled in configuration")
		})

		it("should create local reranker successfully", async () => {
			const mockReranker = {
				validateConfiguration: vi.fn().mockResolvedValue({ valid: true }),
				healthCheck: vi.fn().mockResolvedValue(true),
			}
			;(LocalReranker as any).mockImplementation(() => mockReranker)

			const result = await RerankerFactory.create(mockValidConfig)

			expect(LocalReranker).toHaveBeenCalledWith(mockValidConfig)
			expect(mockReranker.validateConfiguration).toHaveBeenCalled()
			expect(mockReranker.healthCheck).toHaveBeenCalled()
			expect(result).toBe(mockReranker)
			expect(consoleLogSpy).toHaveBeenCalledWith("Successfully created local reranker")
		})

		it("should return undefined when validation fails", async () => {
			const mockReranker = {
				validateConfiguration: vi.fn().mockResolvedValue({
					valid: false,
					error: "Invalid configuration",
				}),
				healthCheck: vi.fn(),
			}
			;(LocalReranker as any).mockImplementation(() => mockReranker)

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBeUndefined()
			expect(mockReranker.validateConfiguration).toHaveBeenCalled()
			expect(mockReranker.healthCheck).not.toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Reranker configuration validation failed: Invalid configuration",
			)
		})

		it("should warn but continue when health check fails", async () => {
			const mockReranker = {
				validateConfiguration: vi.fn().mockResolvedValue({ valid: true }),
				healthCheck: vi.fn().mockResolvedValue(false),
			}
			;(LocalReranker as any).mockImplementation(() => mockReranker)

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBe(mockReranker)
			expect(mockReranker.healthCheck).toHaveBeenCalled()
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Reranker health check failed, but continuing with initialization",
			)
		})

		it("should return undefined for cohere provider (not implemented)", async () => {
			const cohereConfig = { ...mockValidConfig, provider: "cohere" as const }

			const result = await RerankerFactory.create(cohereConfig)

			expect(result).toBeUndefined()
			expect(consoleWarnSpy).toHaveBeenCalledWith("Cohere reranker not yet implemented")
		})

		it("should return undefined for openai provider (not implemented)", async () => {
			const openaiConfig = { ...mockValidConfig, provider: "openai" as const }

			const result = await RerankerFactory.create(openaiConfig)

			expect(result).toBeUndefined()
			expect(consoleWarnSpy).toHaveBeenCalledWith("OpenAI reranker not yet implemented")
		})

		it("should return undefined for custom provider (not implemented)", async () => {
			const customConfig = { ...mockValidConfig, provider: "custom" as const }

			const result = await RerankerFactory.create(customConfig)

			expect(result).toBeUndefined()
			expect(consoleWarnSpy).toHaveBeenCalledWith("Custom reranker not yet implemented")
		})

		it("should return undefined for unknown provider", async () => {
			const unknownConfig = { ...mockValidConfig, provider: "unknown" as any }

			const result = await RerankerFactory.create(unknownConfig)

			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith("Unknown reranker provider: unknown")
		})

		it("should handle constructor errors", async () => {
			;(LocalReranker as any).mockImplementation(() => {
				throw new Error("Constructor error")
			})

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create reranker: Constructor error")
		})

		it("should handle validation errors", async () => {
			const mockReranker = {
				validateConfiguration: vi.fn().mockRejectedValue(new Error("Validation error")),
				healthCheck: vi.fn(),
			}
			;(LocalReranker as any).mockImplementation(() => mockReranker)

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create reranker: Validation error")
		})

		it("should handle health check errors", async () => {
			const mockReranker = {
				validateConfiguration: vi.fn().mockResolvedValue({ valid: true }),
				healthCheck: vi.fn().mockRejectedValue(new Error("Health check error")),
			}
			;(LocalReranker as any).mockImplementation(() => mockReranker)

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create reranker: Health check error")
		})

		it("should handle non-Error exceptions", async () => {
			;(LocalReranker as any).mockImplementation(() => {
				throw "String error"
			})

			const result = await RerankerFactory.create(mockValidConfig)

			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create reranker: String error")
		})
	})

	describe("validateConfig", () => {
		it("should validate valid local config", () => {
			const result = RerankerFactory.validateConfig(mockValidConfig)

			expect(result).toEqual({ valid: true })
		})

		it("should return error when provider is missing", () => {
			const config = { ...mockValidConfig, provider: undefined as any }

			const result = RerankerFactory.validateConfig(config)

			expect(result).toEqual({
				valid: false,
				error: "Provider is required",
			})
		})

		it("should return valid when disabled", () => {
			const config = { ...mockValidConfig, enabled: false }

			const result = RerankerFactory.validateConfig(config)

			expect(result).toEqual({ valid: true })
		})

		describe("local provider validation", () => {
			it("should require url for local provider", () => {
				const config = { ...mockValidConfig, url: undefined }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "Local reranker requires a URL",
				})
			})

			it("should require apiKey for local provider", () => {
				const config = { ...mockValidConfig, apiKey: undefined }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "Local reranker requires an API key",
				})
			})
		})

		describe("cohere provider validation", () => {
			it("should require apiKey for cohere provider", () => {
				const config = {
					...mockValidConfig,
					provider: "cohere" as const,
					apiKey: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "Cohere reranker requires an API key",
				})
			})

			it("should validate cohere config with apiKey", () => {
				const config = {
					...mockValidConfig,
					provider: "cohere" as const,
					apiKey: "cohere-key",
					url: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({ valid: true })
			})
		})

		describe("openai provider validation", () => {
			it("should require apiKey for openai provider", () => {
				const config = {
					...mockValidConfig,
					provider: "openai" as const,
					apiKey: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "OpenAI reranker requires an API key",
				})
			})

			it("should validate openai config with apiKey", () => {
				const config = {
					...mockValidConfig,
					provider: "openai" as const,
					apiKey: "openai-key",
					url: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({ valid: true })
			})
		})

		describe("custom provider validation", () => {
			it("should require url for custom provider", () => {
				const config = {
					...mockValidConfig,
					provider: "custom" as const,
					url: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "Custom reranker requires a URL",
				})
			})

			it("should validate custom config with url", () => {
				const config = {
					...mockValidConfig,
					provider: "custom" as const,
					url: "http://custom-reranker.com",
					apiKey: undefined,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({ valid: true })
			})
		})

		it("should return error for unknown provider", () => {
			const config = { ...mockValidConfig, provider: "unknown" as any }

			const result = RerankerFactory.validateConfig(config)

			expect(result).toEqual({
				valid: false,
				error: "Unknown provider: unknown",
			})
		})

		describe("numeric field validation", () => {
			it("should validate topN must be greater than 0", () => {
				const config = { ...mockValidConfig, topN: 0 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "topN must be greater than 0",
				})
			})

			it("should validate topN negative value", () => {
				const config = { ...mockValidConfig, topN: -5 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "topN must be greater than 0",
				})
			})

			it("should validate topK must be greater than 0", () => {
				const config = { ...mockValidConfig, topK: 0 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "topK must be greater than 0",
				})
			})

			it("should validate topK negative value", () => {
				const config = { ...mockValidConfig, topK: -10 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "topK must be greater than 0",
				})
			})

			it("should validate topK cannot be greater than topN", () => {
				const config = { ...mockValidConfig, topN: 50, topK: 100 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "topK cannot be greater than topN",
				})
			})

			it("should validate timeout must be greater than 0", () => {
				const config = { ...mockValidConfig, timeout: 0 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "timeout must be greater than 0",
				})
			})

			it("should validate timeout negative value", () => {
				const config = { ...mockValidConfig, timeout: -1000 }

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({
					valid: false,
					error: "timeout must be greater than 0",
				})
			})

			it("should allow undefined numeric fields", () => {
				const config = {
					enabled: true,
					provider: "local" as const,
					url: "http://localhost",
					apiKey: "key",
					topN: 100,
					topK: 20,
					timeout: 10000,
				}

				const result = RerankerFactory.validateConfig(config)

				expect(result).toEqual({ valid: true })
			})
		})
	})

	describe("getSupportedProviders", () => {
		it("should return all supported providers", () => {
			const providers = RerankerFactory.getSupportedProviders()

			expect(providers).toEqual(["local", "cohere", "openai", "custom"])
		})
	})

	describe("isProviderImplemented", () => {
		it("should return true for local provider", () => {
			expect(RerankerFactory.isProviderImplemented("local")).toBe(true)
		})

		it("should return false for cohere provider", () => {
			expect(RerankerFactory.isProviderImplemented("cohere")).toBe(false)
		})

		it("should return false for openai provider", () => {
			expect(RerankerFactory.isProviderImplemented("openai")).toBe(false)
		})

		it("should return false for custom provider", () => {
			expect(RerankerFactory.isProviderImplemented("custom")).toBe(false)
		})

		it("should return false for unknown provider", () => {
			expect(RerankerFactory.isProviderImplemented("unknown")).toBe(false)
		})

		it("should return false for empty string", () => {
			expect(RerankerFactory.isProviderImplemented("")).toBe(false)
		})
	})
})
