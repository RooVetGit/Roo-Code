// npx jest src/api/providers/fetchers/__tests__/openrouter.test.ts

import path from "path"

import { back as nockBack } from "nock"

import { getOpenRouterModels } from "../openrouter"

nockBack.fixtures = path.join(__dirname, "fixtures")
nockBack.setMode("dryrun")

describe("OpenRouter API", () => {
	describe("getOpenRouterModels", () => {
		it("fetches models and validates schema", async () => {
			const { nockDone } = await nockBack("openrouter-models.json")

			const models = await getOpenRouterModels()

			const modelsSupportingPromptCache = Object.entries(models)
				.filter(([_, model]) => model.supportsPromptCache)
				.map(([id, _]) => id)
				.sort()

			expect(modelsSupportingPromptCache).toEqual([
				"anthropic/claude-3-haiku",
				"anthropic/claude-3-haiku:beta",
				"anthropic/claude-3-opus",
				"anthropic/claude-3-opus:beta",
				"anthropic/claude-3-sonnet",
				"anthropic/claude-3-sonnet:beta",
				"anthropic/claude-3.5-haiku",
				"anthropic/claude-3.5-haiku-20241022",
				"anthropic/claude-3.5-haiku-20241022:beta",
				"anthropic/claude-3.5-haiku:beta",
				"anthropic/claude-3.5-sonnet",
				"anthropic/claude-3.5-sonnet-20240620",
				"anthropic/claude-3.5-sonnet-20240620:beta",
				"anthropic/claude-3.5-sonnet:beta",
				"anthropic/claude-3.7-sonnet",
				"anthropic/claude-3.7-sonnet:beta",
				"anthropic/claude-3.7-sonnet:thinking",
				"google/gemini-2.0-flash-001",
				"google/gemini-flash-1.5",
				"google/gemini-flash-1.5-8b",
			])

			const modelsSupportingComputerUse = Object.entries(models)
				.filter(([_, model]) => model.supportsComputerUse)
				.map(([id, _]) => id)
				.sort()

			expect(modelsSupportingComputerUse).toEqual([
				"anthropic/claude-3.5-sonnet",
				"anthropic/claude-3.5-sonnet:beta",
				"anthropic/claude-3.7-sonnet",
				"anthropic/claude-3.7-sonnet:beta",
				"anthropic/claude-3.7-sonnet:thinking",
			])

			expect(models["anthropic/claude-3.7-sonnet"]).toEqual({
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: expect.any(String),
				thinking: false,
				supportsComputerUse: true,
			})

			expect(models["anthropic/claude-3.7-sonnet:thinking"]).toEqual({
				maxTokens: 128000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: expect.any(String),
				thinking: true,
				supportsComputerUse: true,
			})

			nockDone()
		})
	})
})
