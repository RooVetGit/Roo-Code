// npx vitest run src/api/providers/__tests__/bedrock-cache-strategy.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { AwsBedrockHandler } from "../bedrock"
import type { ProviderSettings } from "@roo-code/types"

// Mock AWS SDK
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	return {
		BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
			send: vi.fn(),
		})),
		ConverseStreamCommand: vi.fn(),
		ConverseCommand: vi.fn(),
	}
})

describe("Bedrock Cache Strategy", () => {
	// Helper function to create a handler with specific options
	function createHandler(overrides: Partial<ProviderSettings> = {}): AwsBedrockHandler {
		const defaultOptions: ProviderSettings = {
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			apiProvider: "bedrock",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
			...overrides,
		}
		return new AwsBedrockHandler(defaultOptions)
	}

	describe("ModelConfigCache", () => {
		it("should cache and retrieve model config", () => {
			const handler1 = createHandler()
			const handler2 = createHandler()

			// First call should compute the config
			const config1 = handler1.getModel()
			expect(config1).toBeDefined()
			expect(config1.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")

			// Second call with same settings should return cached result
			const config2 = handler2.getModel()
			expect(config2).toEqual(config1)
		})

		it("should return different configs for different settings", () => {
			const handler1 = createHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			})
			const handler2 = createHandler({
				apiModelId: "anthropic.claude-3-haiku-20240307-v1:0",
			})

			const config1 = handler1.getModel()
			const config2 = handler2.getModel()

			expect(config1.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			expect(config2.id).toBe("anthropic.claude-3-haiku-20240307-v1:0")
			expect(config1).not.toEqual(config2)
		})

		it("should handle custom ARN configurations", () => {
			const handler = createHandler({
				awsCustomArn: "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
			})

			const config = handler.getModel()
			expect(config).toBeDefined()
			expect(config.id).toBe("anthropic.claude-3-sonnet-20240229-v1:0")
		})

		it("should handle cross-region inference configurations", () => {
			const handler1 = createHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsUseCrossRegionInference: false,
			})
			const handler2 = createHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsUseCrossRegionInference: true,
			})

			const config1 = handler1.getModel()
			const config2 = handler2.getModel()

			// Cross-region inference should affect the model ID
			expect(config1.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			expect(config2.id).toBe("us.anthropic.claude-3-5-sonnet-20241022-v2:0")
		})
	})

	describe("Cache Key Generation", () => {
		it("should generate different cache keys for different configurations", () => {
			const handler1 = createHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				modelMaxTokens: 4000,
			})
			const handler2 = createHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				modelMaxTokens: 8000,
			})

			// Access private method to test cache key generation
			const cache1 = (handler1 as any).modelConfigCache
			const cache2 = (handler2 as any).modelConfigCache

			const key1 = cache1.generateCacheKey((handler1 as any).options)
			const key2 = cache2.generateCacheKey((handler2 as any).options)

			expect(key1).not.toBe(key2)
		})

		it("should generate same cache keys for identical configurations", () => {
			const options = {
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				modelMaxTokens: 4000,
			}

			const handler1 = createHandler(options)
			const handler2 = createHandler(options)

			const cache1 = (handler1 as any).modelConfigCache
			const cache2 = (handler2 as any).modelConfigCache

			const key1 = cache1.generateCacheKey((handler1 as any).options)
			const key2 = cache2.generateCacheKey((handler2 as any).options)

			expect(key1).toBe(key2)
		})
	})

	describe("Cache Invalidation", () => {
		it("should clear cache when clearCacheIfNeeded is called", () => {
			const handler = createHandler()

			// First call should compute and cache the config
			const config1 = handler.getModel()
			expect(config1).toBeDefined()

			// Clear cache manually
			;(handler as any).clearCacheIfNeeded()

			// Second call should recompute (we can't directly verify this without spying on the computeModelConfig method)
			const config2 = handler.getModel()
			expect(config2).toEqual(config1) // Should be the same config but recomputed
		})

		it("should handle cache clear without errors", () => {
			const handler = createHandler()

			// Clear cache when empty - should not throw
			expect(() => {
				;(handler as any).clearCacheIfNeeded()
			}).not.toThrow()

			// Clear cache after use - should not throw
			handler.getModel()
			expect(() => {
				;(handler as any).clearCacheIfNeeded()
			}).not.toThrow()
		})
	})

	describe("Performance Benefits", () => {
		it("should reduce computation time on subsequent calls", () => {
			const handler = createHandler()

			// Mock the computeModelConfig method to track calls
			const computeModelConfigSpy = vi.spyOn(handler as any, "computeModelConfig")

			// First call should compute
			handler.getModel()
			expect(computeModelConfigSpy).toHaveBeenCalledTimes(1)

			// Second call should use cache
			handler.getModel()
			expect(computeModelConfigSpy).toHaveBeenCalledTimes(1) // Still 1, not 2

			computeModelConfigSpy.mockRestore()
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty or undefined model configurations", () => {
			const handler = createHandler({
				apiModelId: "",
			})

			expect(() => {
				handler.getModel()
			}).not.toThrow()
		})

		it("should handle temperature overrides correctly", () => {
			const handler1 = createHandler({
				modelTemperature: 0.5,
			})
			const handler2 = createHandler({
				modelTemperature: 0.7,
			})

			const config1 = handler1.getModel()
			const config2 = handler2.getModel()

			expect(config1.temperature).toBe(0.5)
			expect(config2.temperature).toBe(0.7)
		})

		it("should handle context window overrides correctly", () => {
			const handler1 = createHandler({
				awsModelContextWindow: 100000,
			})
			const handler2 = createHandler({
				awsModelContextWindow: 200000,
			})

			const config1 = handler1.getModel()
			const config2 = handler2.getModel()

			expect(config1.info.contextWindow).toBe(100000)
			expect(config2.info.contextWindow).toBe(200000)
		})
	})
})
