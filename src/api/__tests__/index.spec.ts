// npx vitest run src/api/__tests__/env-var-integration.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getEnvVar, buildApiHandler } from "../index"
import type { ProviderSettings } from "@roo-code/types"

// Mock all the handler classes
vi.mock("../providers", () => ({
	AnthropicHandler: vi.fn().mockImplementation((options) => ({ provider: "anthropic", options })),
	GlamaHandler: vi.fn().mockImplementation((options) => ({ provider: "glama", options })),
	OpenRouterHandler: vi.fn().mockImplementation((options) => ({ provider: "openrouter", options })),
	OpenAiHandler: vi.fn().mockImplementation((options) => ({ provider: "openai", options })),
	GeminiHandler: vi.fn().mockImplementation((options) => ({ provider: "gemini", options })),
	OpenAiNativeHandler: vi.fn().mockImplementation((options) => ({ provider: "openai-native", options })),
	MistralHandler: vi.fn().mockImplementation((options) => ({ provider: "mistral", options })),
	DeepSeekHandler: vi.fn().mockImplementation((options) => ({ provider: "deepseek", options })),
	UnboundHandler: vi.fn().mockImplementation((options) => ({ provider: "unbound", options })),
	RequestyHandler: vi.fn().mockImplementation((options) => ({ provider: "requesty", options })),
	XAIHandler: vi.fn().mockImplementation((options) => ({ provider: "xai", options })),
	GroqHandler: vi.fn().mockImplementation((options) => ({ provider: "groq", options })),
	ChutesHandler: vi.fn().mockImplementation((options) => ({ provider: "chutes", options })),
	LiteLLMHandler: vi.fn().mockImplementation((options) => ({ provider: "litellm", options })),
	ClaudeCodeHandler: vi.fn().mockImplementation((options) => ({ provider: "claude-code", options })),
	AwsBedrockHandler: vi.fn().mockImplementation((options) => ({ provider: "bedrock", options })),
	VertexHandler: vi.fn().mockImplementation((options) => ({ provider: "vertex", options })),
	AnthropicVertexHandler: vi.fn().mockImplementation((options) => ({ provider: "anthropic-vertex", options })),
	OllamaHandler: vi.fn().mockImplementation((options) => ({ provider: "ollama", options })),
	LmStudioHandler: vi.fn().mockImplementation((options) => ({ provider: "lmstudio", options })),
	MoonshotHandler: vi.fn().mockImplementation((options) => ({ provider: "moonshot", options })),
	VsCodeLmHandler: vi.fn().mockImplementation((options) => ({ provider: "vscode-lm", options })),
	HumanRelayHandler: vi.fn().mockImplementation(() => ({ provider: "human-relay" })),
	FakeAIHandler: vi.fn().mockImplementation((options) => ({ provider: "fake-ai", options })),
	HuggingFaceHandler: vi.fn().mockImplementation((options) => ({ provider: "huggingface", options })),
}))

describe("API Environment Variable Integration", () => {
	const originalEnv = process.env

	beforeEach(() => {
		vi.resetModules()
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe("getEnvVar function", () => {
		it("should return environment variable when it exists", () => {
			process.env.TEST_KEY = "test-value"
			const result = getEnvVar("TEST_KEY")
			expect(result).toBe("test-value")
		})

		it("should return default value when environment variable does not exist", () => {
			delete process.env.TEST_KEY
			const result = getEnvVar("TEST_KEY", "default-value")
			expect(result).toBe("default-value")
		})

		it("should return undefined when key is undefined and no default provided", () => {
			const result = getEnvVar(undefined)
			expect(result).toBeUndefined()
		})

		it("should return default value when key is undefined", () => {
			const result = getEnvVar(undefined, "default-value")
			expect(result).toBe("default-value")
		})

		it("should prioritize environment variable over default", () => {
			process.env.TEST_KEY = "env-value"
			const result = getEnvVar("TEST_KEY", "default-value")
			expect(result).toBe("env-value")
		})

		it("should handle empty string environment variable", () => {
			process.env.TEST_KEY = ""
			const result = getEnvVar("TEST_KEY", "default-value")
			expect(result).toBe("")
		})
	})

	describe("buildApiHandler environment variable integration", () => {
		describe("anthropic provider", () => {
			it("should use environment variable when anthropicConfigUseEnvVars is true", () => {
				process.env.ANTHROPIC_API_KEY = "env-anthropic-key"
				
				const config: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: "config-key",
					anthropicConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.apiKey).toBe("env-anthropic-key")
			})

			it("should use config value when anthropicConfigUseEnvVars is false", () => {
				process.env.ANTHROPIC_API_KEY = "env-anthropic-key"
				
				const config: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: "config-key",
					anthropicConfigUseEnvVars: false,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.apiKey).toBe("config-key")
			})

			it("should fallback to config value when env var not set", () => {
				delete process.env.ANTHROPIC_API_KEY
				
				const config: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: "config-key",
					anthropicConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.apiKey).toBe("config-key")
			})
		})

		describe("glama provider", () => {
			it("should use environment variable when glamaConfigUseEnvVars is true", () => {
				process.env.GLAMA_API_KEY = "env-glama-key"
				
				const config: ProviderSettings = {
					apiProvider: "glama",
					glamaApiKey: "config-key",
					glamaConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.glamaApiKey).toBe("env-glama-key")
			})

			it("should use config value when glamaConfigUseEnvVars is false", () => {
				process.env.GLAMA_API_KEY = "env-glama-key"
				
				const config: ProviderSettings = {
					apiProvider: "glama",
					glamaApiKey: "config-key",
					glamaConfigUseEnvVars: false,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.glamaApiKey).toBe("config-key")
			})
		})

		describe("openrouter provider", () => {
			it("should use environment variable when openRouterConfigUseEnvVars is true", () => {
				process.env.OPEN_ROUTER_API_KEY = "env-openrouter-key"
				
				const config: ProviderSettings = {
					apiProvider: "openrouter",
					openRouterApiKey: "config-key",
					openRouterConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.openRouterApiKey).toBe("env-openrouter-key")
			})
		})

		describe("openai provider", () => {
			it("should use environment variable when openAiConfigUseEnvVars is true", () => {
				process.env.OPENAI_API_KEY = "env-openai-key"
				
				const config: ProviderSettings = {
					apiProvider: "openai",
					openAiApiKey: "config-key",
					openAiConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.openAiApiKey).toBe("env-openai-key")
			})
		})

		describe("gemini provider", () => {
			it("should use environment variable when geminiConfigUseEnvVars is true", () => {
				process.env.GEMINI_API_KEY = "env-gemini-key"
				
				const config: ProviderSettings = {
					apiProvider: "gemini",
					geminiApiKey: "config-key",
					geminiConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.geminiApiKey).toBe("env-gemini-key")
			})
		})

		describe("openai-native provider", () => {
			it("should use environment variable when openAiNativeConfigUseEnvVars is true", () => {
				process.env.OPENAI_API_KEY = "env-openai-native-key"
				
				const config: ProviderSettings = {
					apiProvider: "openai-native",
					openAiNativeApiKey: "config-key",
					openAiNativeConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.openAiNativeApiKey).toBe("env-openai-native-key")
			})
		})

		describe("mistral provider", () => {
			it("should use environment variable when mistralConfigUseEnvVars is true", () => {
				process.env.MISTRAL_API_KEY = "env-mistral-key"
				
				const config: ProviderSettings = {
					apiProvider: "mistral",
					mistralApiKey: "config-key",
					mistralConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.mistralApiKey).toBe("env-mistral-key")
			})
		})

		describe("deepseek provider", () => {
			it("should use environment variable when deepSeekConfigUseEnvVars is true", () => {
				process.env.DEEP_SEEK_API_KEY = "env-deepseek-key"
				
				const config: ProviderSettings = {
					apiProvider: "deepseek",
					deepSeekApiKey: "config-key",
					deepSeekConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.deepSeekApiKey).toBe("env-deepseek-key")
			})
		})

		describe("unbound provider", () => {
			it("should use environment variable when unboundConfigUseEnvVars is true", () => {
				process.env.UNBOUND_API_KEY = "env-unbound-key"
				
				const config: ProviderSettings = {
					apiProvider: "unbound",
					unboundApiKey: "config-key",
					unboundConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.unboundApiKey).toBe("env-unbound-key")
			})
		})

		describe("requesty provider", () => {
			it("should use environment variable when requestyConfigUseEnvVars is true", () => {
				process.env.REQUESTY_API_KEY = "env-requesty-key"
				
				const config: ProviderSettings = {
					apiProvider: "requesty",
					requestyApiKey: "config-key",
					requestyConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.requestyApiKey).toBe("env-requesty-key")
			})
		})

		describe("xai provider", () => {
			it("should use environment variable when xaiConfigUseEnvVars is true", () => {
				process.env.XAI_API_KEY = "env-xai-key"
				
				const config: ProviderSettings = {
					apiProvider: "xai",
					xaiApiKey: "config-key",
					xaiConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.xaiApiKey).toBe("env-xai-key")
			})
		})

		describe("groq provider", () => {
			it("should use environment variable when groqConfigUseEnvVars is true", () => {
				process.env.GROQ_API_KEY = "env-groq-key"
				
				const config: ProviderSettings = {
					apiProvider: "groq",
					groqApiKey: "config-key",
					groqConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.groqApiKey).toBe("env-groq-key")
			})
		})

		describe("chutes provider", () => {
			it("should use environment variable when chutesConfigUseEnvVars is true", () => {
				process.env.CHUTES_API_KEY = "env-chutes-key"
				
				const config: ProviderSettings = {
					apiProvider: "chutes",
					chutesApiKey: "config-key",
					chutesConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.chutesApiKey).toBe("env-chutes-key")
			})
		})

		describe("litellm provider", () => {
			it("should use environment variable when litellmConfigUseEnvVars is true", () => {
				process.env.LITELLM_API_KEY = "env-litellm-key"
				
				const config: ProviderSettings = {
					apiProvider: "litellm",
					litellmApiKey: "config-key",
					litellmConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.litellmApiKey).toBe("env-litellm-key")
			})
		})

		describe("providers without environment variable support", () => {
			it("should not modify options for claude-code provider", () => {
				const config: ProviderSettings = {
					apiProvider: "claude-code",
					apiKey: "config-key",
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.apiKey).toBe("config-key")
			})

			it("should not modify options for bedrock provider", () => {
				const config: ProviderSettings = {
					apiProvider: "bedrock",
				}

				const handler = buildApiHandler(config) as any
				expect(handler.provider).toBe("bedrock")
			})

			it("should not modify options for providers that don't have env var flags", () => {
				const config: ProviderSettings = {
					apiProvider: "ollama",
				}

				const handler = buildApiHandler(config) as any
				expect(handler.provider).toBe("ollama")
			})
		})

		describe("edge cases", () => {
			it("should handle missing apiKeyUseEnvVar flag gracefully", () => {
				process.env.ANTHROPIC_API_KEY = "env-anthropic-key"
				
				const config: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: "config-key",
					// anthropicConfigUseEnvVars is intentionally omitted
				}

				const handler = buildApiHandler(config) as any
				// Should use config value since flag is falsy
				expect(handler.options.apiKey).toBe("config-key")
			})

			it("should handle all supported environment variables", () => {
				const envVars = [
					"ANTHROPIC_API_KEY",
					"GLAMA_API_KEY",
					"OPEN_ROUTER_API_KEY",
					"OPENAI_API_KEY",
					"GEMINI_API_KEY",
					"MISTRAL_API_KEY",
					"DEEP_SEEK_API_KEY",
					"UNBOUND_API_KEY",
					"REQUESTY_API_KEY",
					"XAI_API_KEY",
					"GROQ_API_KEY",
					"CHUTES_API_KEY",
					"LITELLM_API_KEY"
				]

				envVars.forEach((envVar, index) => {
					process.env[envVar] = `test-value-${index}`
				})

				// Test that getEnvVar can handle all these environment variables
				envVars.forEach((envVar, index) => {
					const result = getEnvVar(envVar)
					expect(result).toBe(`test-value-${index}`)
				})
			})

			it("should not mutate original config object", () => {
				process.env.ANTHROPIC_API_KEY = "env-anthropic-key"
				
				const originalConfig: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: "config-key",
					anthropicConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(originalConfig) as any

				// Verify the handler got the environment variable
				expect(handler.options.apiKey).toBe("env-anthropic-key")
				// The original config should remain unchanged due to object destructuring
				expect(originalConfig.apiKey).toBe("config-key")
			})

			it("should handle undefined config values gracefully", () => {
				process.env.ANTHROPIC_API_KEY = "env-anthropic-key"
				
				const config: ProviderSettings = {
					apiProvider: "anthropic",
					apiKey: undefined as any,
					anthropicConfigUseEnvVars: true,
				}

				const handler = buildApiHandler(config) as any
				expect(handler.options.apiKey).toBe("env-anthropic-key")
			})
		})
	})
})