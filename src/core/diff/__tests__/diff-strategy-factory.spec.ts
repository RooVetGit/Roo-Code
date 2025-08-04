import { describe, it, expect } from "vitest"
import { createDiffStrategy, getDiffStrategyName } from "../diff-strategy-factory"
import { MultiSearchReplaceDiffStrategy } from "../strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../strategies/multi-file-search-replace"
import { SimpleSearchReplaceDiffStrategy } from "../strategies/simple-search-replace"

describe("diff-strategy-factory", () => {
	describe("createDiffStrategy", () => {
		describe("Claude models", () => {
			const claudeModelIds = [
				"claude-3-opus-20240229",
				"claude-3-sonnet-20240229",
				"claude-3-haiku-20240307",
				"claude-2.1",
				"claude-instant-1.2",
				"anthropic/claude-3-opus",
				"Claude-3-Opus",
				"CLAUDE-3-SONNET",
			]

			claudeModelIds.forEach((modelId) => {
				it(`should return MultiSearchReplaceDiffStrategy for ${modelId}`, () => {
					const strategy = createDiffStrategy({
						modelId,
						fuzzyMatchThreshold: 0.9,
					})
					expect(strategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
					expect(strategy.getName()).toBe("MultiSearchReplace")
				})

				it(`should return MultiFileSearchReplaceDiffStrategy for ${modelId} with useMultiFile`, () => {
					const strategy = createDiffStrategy({
						modelId,
						fuzzyMatchThreshold: 0.9,
						useMultiFile: true,
					})
					expect(strategy).toBeInstanceOf(MultiFileSearchReplaceDiffStrategy)
					expect(strategy.getName()).toBe("MultiFileSearchReplace")
				})
			})
		})

		describe("Non-Claude models", () => {
			const nonClaudeModelIds = [
				"gpt-4",
				"gpt-3.5-turbo",
				"openai/gpt-4",
				"deepseek-coder",
				"qwen-32b",
				"mistral-large",
				"gemini-pro",
				"llama-3-70b",
				"codellama-34b",
			]

			nonClaudeModelIds.forEach((modelId) => {
				it(`should return SimpleSearchReplaceDiffStrategy for ${modelId}`, () => {
					const strategy = createDiffStrategy({
						modelId,
						fuzzyMatchThreshold: 0.9,
					})
					expect(strategy).toBeInstanceOf(SimpleSearchReplaceDiffStrategy)
					expect(strategy.getName()).toBe("SimpleSearchReplace")
				})

				it(`should still return SimpleSearchReplaceDiffStrategy for ${modelId} even with useMultiFile`, () => {
					const strategy = createDiffStrategy({
						modelId,
						fuzzyMatchThreshold: 0.9,
						useMultiFile: true,
					})
					expect(strategy).toBeInstanceOf(SimpleSearchReplaceDiffStrategy)
					expect(strategy.getName()).toBe("SimpleSearchReplace")
				})
			})
		})

		describe("Edge cases", () => {
			it("should handle empty model ID", () => {
				const strategy = createDiffStrategy({
					modelId: "",
					fuzzyMatchThreshold: 0.9,
				})
				expect(strategy).toBeInstanceOf(SimpleSearchReplaceDiffStrategy)
			})

			it("should handle undefined fuzzyMatchThreshold", () => {
				const strategy = createDiffStrategy({
					modelId: "claude-3-opus",
				})
				expect(strategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
			})

			it("should handle undefined bufferLines", () => {
				const strategy = createDiffStrategy({
					modelId: "gpt-4",
					fuzzyMatchThreshold: 0.9,
				})
				expect(strategy).toBeInstanceOf(SimpleSearchReplaceDiffStrategy)
			})
		})
	})

	describe("getDiffStrategyName", () => {
		describe("Claude models", () => {
			it("should return MultiSearchReplace for Claude models without useMultiFile", () => {
				expect(getDiffStrategyName("claude-3-opus")).toBe("MultiSearchReplace")
				expect(getDiffStrategyName("claude-2.1")).toBe("MultiSearchReplace")
				expect(getDiffStrategyName("CLAUDE-instant")).toBe("MultiSearchReplace")
			})

			it("should return MultiFileSearchReplace for Claude models with useMultiFile", () => {
				expect(getDiffStrategyName("claude-3-opus", true)).toBe("MultiFileSearchReplace")
				expect(getDiffStrategyName("claude-2.1", true)).toBe("MultiFileSearchReplace")
				expect(getDiffStrategyName("CLAUDE-instant", true)).toBe("MultiFileSearchReplace")
			})
		})

		describe("Non-Claude models", () => {
			it("should return SimpleSearchReplace for non-Claude models", () => {
				expect(getDiffStrategyName("gpt-4")).toBe("SimpleSearchReplace")
				expect(getDiffStrategyName("deepseek-coder")).toBe("SimpleSearchReplace")
				expect(getDiffStrategyName("mistral-large")).toBe("SimpleSearchReplace")
			})

			it("should return SimpleSearchReplace for non-Claude models even with useMultiFile", () => {
				expect(getDiffStrategyName("gpt-4", true)).toBe("SimpleSearchReplace")
				expect(getDiffStrategyName("deepseek-coder", true)).toBe("SimpleSearchReplace")
				expect(getDiffStrategyName("mistral-large", true)).toBe("SimpleSearchReplace")
			})
		})

		describe("Edge cases", () => {
			it("should handle empty model ID", () => {
				expect(getDiffStrategyName("")).toBe("SimpleSearchReplace")
			})

			it("should handle special characters in model ID", () => {
				expect(getDiffStrategyName("claude@3#opus")).toBe("MultiSearchReplace")
				expect(getDiffStrategyName("gpt@4#turbo")).toBe("SimpleSearchReplace")
			})
		})
	})
})
