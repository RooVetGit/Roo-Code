// npx vitest run api/providers/__tests__/openai-timeout-integration.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenAiHandler } from "../openai"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"
import { ApiHandlerOptions } from "../../../shared/api"
import type { ModelInfo } from "@roo-code/types"

// Mock OpenAI module
const mockCreate = vi.fn()
const mockOpenAIConstructor = vi.fn()

vi.mock("openai", () => ({
	default: class MockOpenAI {
		constructor(config: any) {
			mockOpenAIConstructor(config)
			return {
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}
		}
	},
	AzureOpenAI: class MockAzureOpenAI {
		constructor(config: any) {
			mockOpenAIConstructor(config)
			return {
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}
		}
	},
}))

// Test provider implementation
class TestProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Test Provider",
			baseURL: "https://api.test.com",
			defaultProviderModelId: "test-model",
			providerModels: {
				"test-model": {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsImages: false,
					supportsPromptCache: false,
				} as ModelInfo,
			},
		})
	}
}

describe("OpenAI timeout integration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("OpenAiHandler", () => {
		it("should pass timeout configuration to OpenAI client", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
				openAiRequestTimeout: 600000, // 10 minutes
			}

			new OpenAiHandler(options)

			// Check that OpenAI constructor was called with fetch option
			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
			expect(typeof constructorCall.fetch).toBe("function")
		})

		it("should work without timeout configuration", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
			}

			new OpenAiHandler(options)

			// Should still have fetch function even without explicit timeout
			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
		})

		it("should handle Azure OpenAI configuration with timeout", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
				openAiBaseUrl: "https://test.openai.azure.com",
				azureApiVersion: "2024-05-01-preview",
				openAiRequestTimeout: 1200000, // 20 minutes
			}

			new OpenAiHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
			expect(constructorCall.baseURL).toBe("https://test.openai.azure.com")
		})

		it("should handle Azure AI Inference Service with timeout", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "deepseek-v3",
				openAiBaseUrl: "https://test.services.ai.azure.com",
				openAiRequestTimeout: 1800000, // 30 minutes
			}

			new OpenAiHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
			expect(constructorCall.baseURL).toBe("https://test.services.ai.azure.com")
		})
	})

	describe("BaseOpenAiCompatibleProvider", () => {
		it("should use timeout configuration in derived providers", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				openAiRequestTimeout: 900000, // 15 minutes
			}

			new TestProvider(options)

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
			expect(constructorCall.apiKey).toBe("test-key")
			expect(constructorCall.baseURL).toBe("https://api.test.com")
		})

		it("should use default timeout when not specified", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
			}

			new TestProvider(options)

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
		})

		it("should handle zero timeout value", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				openAiRequestTimeout: 0,
			}

			new TestProvider(options)

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
		})
	})

	describe("timeout behavior", () => {
		it("should allow very large timeouts for slow local models", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "local-llama",
				openAiRequestTimeout: 7200000, // 2 hours
			}

			expect(() => new OpenAiHandler(options)).not.toThrow()

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
		})

		it("should handle negative timeout values gracefully", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				openAiRequestTimeout: -5000,
			}

			expect(() => new TestProvider(options)).not.toThrow()

			expect(mockOpenAIConstructor).toHaveBeenCalled()
			const constructorCall = mockOpenAIConstructor.mock.calls[0][0]
			expect(constructorCall).toHaveProperty("fetch")
		})
	})
})
