import { describe, it, expect } from "vitest"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { RouterModels } from "@roo/api"

// Mock the internal getSelectedModel function for OpenRouter case only
function getSelectedModelOpenRouter({
	apiConfiguration,
	routerModels,
	openRouterModelProviders,
}: {
	apiConfiguration: ProviderSettings
	routerModels: RouterModels
	openRouterModelProviders: Record<string, ModelInfo>
}): { id: string; info: ModelInfo | undefined } {
	const id = apiConfiguration.openRouterModelId ?? "anthropic/claude-sonnet-4"
	let info = routerModels.openrouter[id]

	// Determine which provider to use for model info
	let providerToUse: string | undefined

	// Check multi-provider configuration first
	if (apiConfiguration.openRouterProviders && apiConfiguration.openRouterProviders.length > 0) {
		// Use the first (primary) provider from the multi-provider list
		providerToUse = apiConfiguration.openRouterProviders[0]
	} else {
		// Fallback to legacy single provider
		providerToUse = apiConfiguration.openRouterSpecificProvider
	}

	if (providerToUse && openRouterModelProviders[providerToUse]) {
		// Overwrite the info with the selected provider info. Some
		// fields are missing the model info for `openRouterModelProviders`
		// so we need to merge the two.
		info = info ? { ...info, ...openRouterModelProviders[providerToUse] } : openRouterModelProviders[providerToUse]
	}

	return { id, info }
}

describe("useSelectedModel Multi-Provider Support", () => {
	const mockRouterModels: RouterModels = {
		openrouter: {
			"moonshot/kimi-k2": {
				maxTokens: 120000,
				contextWindow: 120000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 0.0014,
				outputPrice: 0.0028,
			},
		},
		requesty: {},
		glama: {},
		unbound: {},
		litellm: {},
		ollama: {},
		lmstudio: {},
		"io-intelligence": {},
	}

	const mockOpenRouterModelProviders = {
		groq: {
			maxTokens: 16400,
			contextWindow: 131100,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 1.0,
			outputPrice: 3.0,
			cacheReadsPrice: 0.5,
			label: "Groq",
		},
		novitaai: {
			maxTokens: 131100,
			contextWindow: 131100,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.57,
			outputPrice: 2.3,
			label: "NovitaAI",
		},
		fireworks: {
			maxTokens: 131100,
			contextWindow: 131100,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.6,
			outputPrice: 2.5,
			label: "Fireworks",
		},
		atlascloud: {
			maxTokens: 131100,
			contextWindow: 131100,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.7,
			outputPrice: 2.5,
			label: "AtlasCloud",
		},
		targon: {
			maxTokens: 63000,
			contextWindow: 63000,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.14,
			outputPrice: 2.49,
			label: "Targon",
		},
	}

	describe("multi-provider context window selection", () => {
		it("should use primary provider context window when multi-provider is configured", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "moonshot/kimi-k2",
				openRouterProviders: ["groq", "novitaai", "fireworks", "atlascloud"], // Primary = Groq
				openRouterFailoverEnabled: true,
			}

			const result = getSelectedModelOpenRouter({
				apiConfiguration,
				routerModels: mockRouterModels,
				openRouterModelProviders: mockOpenRouterModelProviders,
			})

			// Should use Groq's context window (131100), not base model's (120000) or Targon's (63000)
			expect(result.info?.contextWindow).toBe(131100)
			expect(result.info?.inputPrice).toBe(1.0) // Groq's pricing
			expect(result.info?.outputPrice).toBe(3.0) // Groq's pricing
			expect(result.info?.supportsPromptCache).toBe(true) // Groq's cache support
		})

		it("should fallback to legacy single provider when multi-provider not configured", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "moonshot/kimi-k2",
				openRouterSpecificProvider: "fireworks", // Legacy single provider
			}

			const result = getSelectedModelOpenRouter({
				apiConfiguration,
				routerModels: mockRouterModels,
				openRouterModelProviders: mockOpenRouterModelProviders,
			})

			// Should use Fireworks' context window (131100), not base model's (120000)
			expect(result.info?.contextWindow).toBe(131100)
			expect(result.info?.inputPrice).toBe(0.6) // Fireworks' pricing
			expect(result.info?.outputPrice).toBe(2.5) // Fireworks' pricing
		})

		it("should prefer multi-provider over legacy when both are configured", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "moonshot/kimi-k2",
				openRouterProviders: ["novitaai", "groq"], // Primary = NovitaAI
				openRouterSpecificProvider: "targon", // Legacy provider (should be ignored)
			}

			const result = getSelectedModelOpenRouter({
				apiConfiguration,
				routerModels: mockRouterModels,
				openRouterModelProviders: mockOpenRouterModelProviders,
			})

			// Should use NovitaAI's context window (131100), NOT Targon's (63000)
			expect(result.info?.contextWindow).toBe(131100)
			expect(result.info?.inputPrice).toBe(0.57) // NovitaAI's pricing, not Targon's 0.14
			expect(result.info?.outputPrice).toBe(2.3) // NovitaAI's pricing, not Targon's 2.49
		})

		it("should use base model info when no providers are configured", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "openrouter",
				openRouterModelId: "moonshot/kimi-k2",
				// No providers configured
			}

			const result = getSelectedModelOpenRouter({
				apiConfiguration,
				routerModels: mockRouterModels,
				openRouterModelProviders: mockOpenRouterModelProviders,
			})

			// Should use base model's context window (120000)
			expect(result.info?.contextWindow).toBe(120000)
			expect(result.info?.inputPrice).toBe(0.0014)
			expect(result.info?.outputPrice).toBe(0.0028)
		})
	})
})
