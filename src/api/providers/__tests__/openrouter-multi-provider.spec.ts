import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { OpenRouterHandler } from "../openrouter"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI
vi.mock("openai")

describe("OpenRouterHandler Multi-Provider Support", () => {
	let mockOptions: ApiHandlerOptions
	let handler: OpenRouterHandler

	beforeEach(() => {
		mockOptions = {
			openRouterApiKey: "test-api-key",
			openRouterModelId: "anthropic/claude-sonnet-4",
			openRouterFailoverEnabled: true,
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getProvidersToUse", () => {
		it("should return multi-provider configuration when available", () => {
			const optionsWithMultiProvider: ApiHandlerOptions = {
				...mockOptions,
				openRouterProviders: ["provider1", "provider2", "provider3"],
			}
			handler = new OpenRouterHandler(optionsWithMultiProvider)

			// Access private method for testing
			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual(["provider1", "provider2", "provider3"])
		})

		it("should fallback to single provider configuration", () => {
			const optionsWithSingleProvider: ApiHandlerOptions = {
				...mockOptions,
				openRouterSpecificProvider: "single-provider",
			}
			handler = new OpenRouterHandler(optionsWithSingleProvider)

			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual(["single-provider"])
		})

		it("should return empty array when no providers configured", () => {
			handler = new OpenRouterHandler(mockOptions)

			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual([])
		})

		it("should filter out default provider from multi-provider list", () => {
			const optionsWithDefault: ApiHandlerOptions = {
				...mockOptions,
				openRouterProviders: ["provider1", "[default]", "provider2"],
			}
			handler = new OpenRouterHandler(optionsWithDefault)

			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual(["provider1", "provider2"])
		})
	})

	describe("shouldFailover", () => {
		beforeEach(() => {
			handler = new OpenRouterHandler(mockOptions)
		})

		it("should failover on rate limit errors (429)", () => {
			const error = { status: 429, message: "Rate limit exceeded" }
			expect((handler as any).shouldFailover(error)).toBe(true)
		})

		it("should failover on service unavailable errors", () => {
			const error503 = { status: 503, message: "Service unavailable" }
			const error502 = { status: 502, message: "Bad gateway" }

			expect((handler as any).shouldFailover(error503)).toBe(true)
			expect((handler as any).shouldFailover(error502)).toBe(true)
		})

		it("should failover on context window errors", () => {
			const contextErrors = [
				{ status: 400, message: "context length exceeded" },
				{ status: 400, message: "maximum context window reached" },
				{ status: 400, message: "too many tokens in request" },
				{ status: 400, message: "input tokens exceed limit" },
			]

			contextErrors.forEach((error) => {
				expect((handler as any).shouldFailover(error)).toBe(true)
			})
		})

		it("should failover on timeout errors", () => {
			const timeoutErrors = [{ code: "ECONNABORTED", message: "timeout" }, { message: "timeout error occurred" }]

			timeoutErrors.forEach((error) => {
				expect((handler as any).shouldFailover(error)).toBe(true)
			})
		})

		it("should not failover on non-failover errors", () => {
			const nonFailoverErrors = [
				{ status: 401, message: "Unauthorized" },
				{ status: 400, message: "Invalid request format" },
				{ status: 500, message: "Internal server error" },
				null,
				undefined,
			]

			nonFailoverErrors.forEach((error) => {
				expect((handler as any).shouldFailover(error)).toBe(false)
			})
		})
	})

	describe("createCompletionParams", () => {
		beforeEach(() => {
			handler = new OpenRouterHandler(mockOptions)
		})

		it("should create params with single provider routing", () => {
			const providers = ["provider1"]
			const params = (handler as any).createCompletionParams(
				"test-model",
				4096,
				0.7,
				0.9,
				[{ role: "user", content: "test" }],
				["middle-out"],
				undefined,
				providers,
				0,
			)

			expect(params.provider).toEqual({
				order: ["provider1"],
				only: ["provider1"],
				allow_fallbacks: false,
			})
		})

		it("should create params with multi-provider routing for first attempt", () => {
			const providers = ["provider1", "provider2", "provider3"]
			const params = (handler as any).createCompletionParams(
				"test-model",
				4096,
				0.7,
				0.9,
				[{ role: "user", content: "test" }],
				["middle-out"],
				undefined,
				providers,
				0,
			)

			expect(params.provider).toEqual({
				order: ["provider1", "provider2", "provider3"],
				only: ["provider1", "provider2", "provider3"],
				allow_fallbacks: true,
			})
		})

		it("should create params with remaining providers for retry attempt", () => {
			const providers = ["provider1", "provider2", "provider3"]
			const params = (handler as any).createCompletionParams(
				"test-model",
				4096,
				0.7,
				0.9,
				[{ role: "user", content: "test" }],
				["middle-out"],
				undefined,
				providers,
				1,
			)

			expect(params.provider).toEqual({
				order: ["provider2", "provider3"],
				only: ["provider2", "provider3"],
				allow_fallbacks: true,
			})
		})

		it("should create params with last provider only for final attempt", () => {
			const providers = ["provider1", "provider2", "provider3"]
			const params = (handler as any).createCompletionParams(
				"test-model",
				4096,
				0.7,
				0.9,
				[{ role: "user", content: "test" }],
				["middle-out"],
				undefined,
				providers,
				2,
			)

			expect(params.provider).toEqual({
				order: ["provider3"],
				only: ["provider3"],
				allow_fallbacks: false,
			})
		})
	})

	describe("backward compatibility", () => {
		it("should support legacy single provider configuration", () => {
			const legacyOptions: ApiHandlerOptions = {
				...mockOptions,
				openRouterSpecificProvider: "legacy-provider",
				openRouterFailoverEnabled: false,
			}
			handler = new OpenRouterHandler(legacyOptions)

			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual(["legacy-provider"])
		})

		it("should prefer multi-provider over single provider when both are set", () => {
			const mixedOptions: ApiHandlerOptions = {
				...mockOptions,
				openRouterProviders: ["multi1", "multi2"],
				openRouterSpecificProvider: "single-provider",
			}
			handler = new OpenRouterHandler(mixedOptions)

			const providers = (handler as any).getProvidersToUse()
			expect(providers).toEqual(["multi1", "multi2"])
		})
	})
})
