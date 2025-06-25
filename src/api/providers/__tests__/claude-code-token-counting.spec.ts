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

			// The text has approximately 13-15 tokens
			// With no fudge factor, we expect the exact token count
			// With the old 1.5x fudge factor, it would have been around 20-23 tokens
			expect(tokenCount).toBeLessThan(16)
			expect(tokenCount).toBeGreaterThan(12)
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

			// Each block is approximately 2-3 tokens, so 6-9 tokens total
			// With no fudge factor, expect exact count
			expect(tokenCount).toBeLessThan(10) // Would be ~15 with old 1.5x factor
			expect(tokenCount).toBeGreaterThan(5)
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
			// Simulate a typical user message with environment details
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: `Hi

<environment_details>
# VSCode Visible Files
src/app.ts
src/utils.ts

# VSCode Open Tabs
src/app.ts

# Current Time
2024-01-01 12:00:00 PM

# Current Context Size (Tokens)
1000 (5%)

# Current Cost
$0.05

# Current Mode
<slug>code</slug>
<name>Code</name>
<model>claude-3-5-sonnet-20241022</model>
</environment_details>`,
				},
			]

			const tokenCount = await handler.countTokens(content)

			// This content is approximately 100-120 tokens
			// With no fudge factor, expect exact count
			// With old 1.5x factor, it would have been 150-180 tokens
			expect(tokenCount).toBeLessThan(125)
			expect(tokenCount).toBeGreaterThan(95)
		})
	})
})
