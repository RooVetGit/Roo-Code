import { describe, it, expect, vi, beforeEach } from "vitest"
import { ClaudeCodeHandler } from "../claude-code"
import { ApiHandlerOptions } from "../../../shared/api"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("ClaudeCodeHandler Token Counting", () => {
	let handler: ClaudeCodeHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "claude-3-5-sonnet-20241022",
			claudeCodePath: "/usr/local/bin/claude",
		} as ApiHandlerOptions

		handler = new ClaudeCodeHandler(mockOptions)
	})

	describe("countTokens", () => {
		it("should count tokens accurately without any fudge factor", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "Hello, this is a test message to verify token counting accuracy.",
				},
			]

			const tokenCount = await handler.countTokens(content)

			// The exact token count for this text using o200k_base tokenizer is 13
			// With the old 1.5x fudge factor, it would have been 20 tokens
			expect(tokenCount).toBe(13)
		})

		it("should handle empty content", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = []
			const tokenCount = await handler.countTokens(content)
			expect(tokenCount).toBe(0)
		})

		it("should handle multiple text blocks", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{ type: "text", text: "First block" },
				{ type: "text", text: "Second block" },
				{ type: "text", text: "Third block" },
			]

			const tokenCount = await handler.countTokens(content)

			// "First block" = 2 tokens, "Second block" = 2 tokens, "Third block" = 2 tokens
			// Total: 6 tokens (would have been 9 with old 1.5x factor)
			expect(tokenCount).toBe(6)
		})

		it("should handle image blocks with conservative estimate", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "image",
					source: {
						type: "base64",
						media_type: "image/jpeg",
						data: "base64data",
					},
				},
			]

			const tokenCount = await handler.countTokens(content)

			// Images get a conservative 300 tokens estimate (no fudge factor)
			expect(tokenCount).toBe(300)
		})

		it("should provide accurate token counts for typical messages", async () => {
			// Use a simpler, predictable message for exact token counting
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "This is a simple test message with exactly predictable token count.",
				},
			]

			const tokenCount = await handler.countTokens(content)

			// This specific text has exactly 12 tokens with o200k_base tokenizer
			// With old 1.5x factor, it would have been 18 tokens
			expect(tokenCount).toBe(12)
		})

		it("should handle mixed content types", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{ type: "text", text: "Hello world" }, // 2 tokens
				{
					type: "image",
					source: {
						type: "base64",
						media_type: "image/jpeg",
						data: "base64data",
					},
				}, // 300 tokens (IMAGE_TOKEN_ESTIMATE)
				{ type: "text", text: "Goodbye" }, // 1 token
			]

			const tokenCount = await handler.countTokens(content)

			// Total: 2 + 300 + 2 = 304 tokens ("Goodbye" is actually 2 tokens)
			expect(tokenCount).toBe(304)
		})

		it("should handle empty text blocks", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{ type: "text", text: "" },
				{ type: "text", text: "Hello" }, // 1 token
				{ type: "text", text: "" },
			]

			const tokenCount = await handler.countTokens(content)

			// Only "Hello" contributes tokens
			expect(tokenCount).toBe(1)
		})
	})
})
