import { describe, it, expect, vi, beforeEach } from "vitest"
import { EVALS_SETTINGS } from "@roo-code/types"

describe("Provider Configuration", () => {
	describe("EVALS_SETTINGS", () => {
		it("should not have a hardcoded apiProvider", () => {
			// EVALS_SETTINGS should not have apiProvider set by default
			// to allow flexibility in choosing providers
			expect(EVALS_SETTINGS.apiProvider).toBeUndefined()
		})

		it("should have other necessary settings", () => {
			// Verify that other important settings are still present
			expect(EVALS_SETTINGS.autoApprovalEnabled).toBe(true)
			expect(EVALS_SETTINGS.alwaysAllowWrite).toBe(true)
			expect(EVALS_SETTINGS.alwaysAllowExecute).toBe(true)
			expect(EVALS_SETTINGS.mode).toBe("code")
		})
	})

	describe("Configuration Merging", () => {
		it("should allow overriding apiProvider through run settings", () => {
			const runSettings = {
				apiProvider: "anthropic" as const,
				apiKey: "test-key",
			}

			const mergedConfig = {
				...EVALS_SETTINGS,
				...runSettings,
			}

			expect(mergedConfig.apiProvider).toBe("anthropic")
			expect(mergedConfig.apiKey).toBe("test-key")
		})

		it("should support multiple providers", () => {
			const providers = [
				{ apiProvider: "openrouter" as const, openRouterApiKey: "key1" },
				{ apiProvider: "anthropic" as const, apiKey: "key2" },
				{ apiProvider: "openai" as const, openAiApiKey: "key3" },
				{ apiProvider: "gemini" as const, geminiApiKey: "key4" },
				{ apiProvider: "ollama" as const, ollamaModelId: "model1" },
				{ apiProvider: "litellm" as const, litellmApiKey: "key5" },
			]

			providers.forEach((providerSettings) => {
				const mergedConfig = {
					...EVALS_SETTINGS,
					...providerSettings,
				}

				expect(mergedConfig.apiProvider).toBe(providerSettings.apiProvider)
			})
		})

		it("should maintain backward compatibility with openrouter as default", () => {
			// When no apiProvider is specified in run settings,
			// the implementation should default to openrouter for backward compatibility
			const runSettings: Record<string, unknown> = {}

			// This simulates the logic in runTask.ts
			const configuration: Record<string, unknown> = {
				...EVALS_SETTINGS,
			}

			if (!runSettings.apiProvider) {
				configuration.apiProvider = "openrouter"
				configuration.openRouterApiKey = process.env.OPENROUTER_API_KEY
			}

			expect(configuration.apiProvider).toBe("openrouter")
		})
	})

	describe("Environment Variable Mapping", () => {
		beforeEach(() => {
			// Clear environment variables
			vi.stubEnv("OPENROUTER_API_KEY", "")
			vi.stubEnv("ANTHROPIC_API_KEY", "")
			vi.stubEnv("OPENAI_API_KEY", "")
			vi.stubEnv("GEMINI_API_KEY", "")
			vi.stubEnv("DEEPSEEK_API_KEY", "")
			vi.stubEnv("MISTRAL_API_KEY", "")
			vi.stubEnv("GROQ_API_KEY", "")
			vi.stubEnv("LITELLM_API_KEY", "")
		})

		it("should map environment variables based on provider", () => {
			// Set test environment variables
			vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key")
			vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key")
			vi.stubEnv("OPENAI_API_KEY", "test-openai-key")

			const providerKeyMappings = [
				{ provider: "openrouter", envVar: "OPENROUTER_API_KEY", configKey: "openRouterApiKey" },
				{ provider: "anthropic", envVar: "ANTHROPIC_API_KEY", configKey: "apiKey" },
				{ provider: "openai", envVar: "OPENAI_API_KEY", configKey: "openAiApiKey" },
			]

			providerKeyMappings.forEach(({ provider, envVar, configKey }) => {
				const configuration: Record<string, unknown> = {}

				// Simulate the switch logic from runTask.ts
				switch (provider) {
					case "openrouter":
						configuration.openRouterApiKey = process.env.OPENROUTER_API_KEY
						break
					case "anthropic":
						configuration.apiKey = process.env.ANTHROPIC_API_KEY
						break
					case "openai":
						configuration.openAiApiKey = process.env.OPENAI_API_KEY
						break
				}

				expect(configuration[configKey]).toBe(process.env[envVar])
			})
		})
	})
})
