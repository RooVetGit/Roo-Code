// npx jest src/utils/__tests__/tiktoken.test.ts

import { tiktoken, getEncoderForProvider, getFudgeFactorForProvider, countImageTokens } from "../tiktoken"
import { Anthropic } from "@anthropic-ai/sdk"

describe("tiktoken", () => {
	it("should return 0 for empty content array", async () => {
		const result = await tiktoken([])
		expect(result).toBe(0)
	})

	it("should correctly count tokens for text content", async () => {
		const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Hello world" }]

		const result = await tiktoken(content)
		// Using cl100k_base, "Hello world" is 2 tokens, plus fudge factor rounding up
		expect(result).toBeGreaterThanOrEqual(2)
	})

	it("should handle empty text content", async () => {
		const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "" }]

		const result = await tiktoken(content)
		expect(result).toBe(0)
	})

	it("should handle missing text content", async () => {
		// Using 'as any' to bypass TypeScript's type checking for this test case
		// since we're specifically testing how the function handles undefined text
		const content = [{ type: "text" }] as any as Anthropic.Messages.ContentBlockParam[]

		const result = await tiktoken(content)
		expect(result).toBe(0)
	})

	it("should correctly count tokens for image content with data", async () => {
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const content: Anthropic.Messages.ContentBlockParam[] = [
			{
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: base64Data,
				},
			},
		]

		const result = await tiktoken(content)
		// For images, we expect a token count based on the square root of the data length
		// plus the fudge factor
		const expectedMinTokens = Math.ceil(Math.sqrt(base64Data.length))
		expect(result).toBeGreaterThanOrEqual(expectedMinTokens)
	})

	it("should use conservative estimate for image content without data", async () => {
		// Using 'as any' to bypass TypeScript's type checking for this test case
		// since we're specifically testing the fallback behavior
		const content = [
			{
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					// data is intentionally missing to test fallback
				},
			},
		] as any as Anthropic.Messages.ContentBlockParam[]

		const result = await tiktoken(content)
		// Conservative estimate is 300 tokens, plus the fudge factor
		const expectedMinTokens = 300
		expect(result).toBeGreaterThanOrEqual(expectedMinTokens)
	})

	it("should correctly count tokens for mixed content", async () => {
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const content: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "Hello world" },
			{
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: base64Data,
				},
			},
			{ type: "text", text: "Goodbye world" },
		]

		const result = await tiktoken(content)
		// We expect a positive token count for mixed content
		expect(result).toBeGreaterThan(0)
	})

	it("should apply a fudge factor to the token count", async () => {
		// We can test the fudge factor by comparing the token count with a rough estimate
		const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Test" }]

		const result = await tiktoken(content)

		// Run the function again with the same content to get a consistent result
		const result2 = await tiktoken(content)

		// Both calls should return the same token count
		expect(result).toBe(result2)

		// The result should be greater than 0
		expect(result).toBeGreaterThan(0)
	})

	it("should reuse the encoder for multiple calls", async () => {
		// We can't directly test the caching behavior without mocking,
		// but we can test that multiple calls with the same content return the same result
		// which indirectly verifies the encoder is working consistently

		const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Hello world" }]

		const result1 = await tiktoken(content)
		const result2 = await tiktoken(content)

		// Both calls should return the same token count
		expect(result1).toBe(result2)
	})

	it("should return different encoders for different providers", () => {
		// Test that we get different encoder instances for different providers
		const openaiEncoder = getEncoderForProvider("openai")
		const anthropicEncoder = getEncoderForProvider("anthropic")
		const googleEncoder = getEncoderForProvider("google")

		// Each provider should have a valid encoder
		expect(openaiEncoder).toBeDefined()
		expect(anthropicEncoder).toBeDefined()
		expect(googleEncoder).toBeDefined()

		// Test encoding the same text with different encoders
		const text = "Hello world"
		const openaiTokens = openaiEncoder.encode(text).length
		const anthropicTokens = anthropicEncoder.encode(text).length

		// We're not testing equality or inequality as encoders might produce the same result
		// for simple text. Just ensuring they work.
		expect(openaiTokens).toBeGreaterThan(0)
		expect(anthropicTokens).toBeGreaterThan(0)
	})

	it("should apply different fudge factors for different providers", () => {
		// Get fudge factors for different providers
		const openAIFudge = getFudgeFactorForProvider("openai")
		const anthropicFudge = getFudgeFactorForProvider("anthropic")
		const googleFudge = getFudgeFactorForProvider("google")
		const openRouterFudge = getFudgeFactorForProvider("openrouter")
		const requestyFudge = getFudgeFactorForProvider("requesty")

		// Verify each provider has an appropriate fudge factor
		expect(openAIFudge).toBeGreaterThan(1.0) // Should be about 1.12
		expect(anthropicFudge).toBeGreaterThan(openAIFudge) // Should be about 1.2
		expect(googleFudge).toBeGreaterThan(anthropicFudge) // Should be about 1.3
		expect(openRouterFudge).toBeGreaterThan(1.0) // Should be about 1.15
		expect(requestyFudge).toBeGreaterThan(1.0) // Should be about 1.15
	})

	it("should count image tokens appropriately for each provider", () => {
		// We'll test URL-based images, which have fixed token counts per provider
		const urlImageSource = {
			url: "http://example.com/image.jpg",
		}

		// Count tokens for different providers using URL images
		const openAIImageTokens = countImageTokens(urlImageSource, "openai")
		const anthropicImageTokens = countImageTokens(urlImageSource, "anthropic")
		const googleImageTokens = countImageTokens(urlImageSource, "google")

		// Each should return the expected token count based on our implementation
		expect(openAIImageTokens).toBe(500) // OpenAI URL-based image tokens
		expect(anthropicImageTokens).toBe(550) // Anthropic URL-based image tokens
		expect(googleImageTokens).toBe(550) // Google URL-based image tokens

		// Test fallback behavior with a very small base64 image
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const base64ImageSource = {
			type: "base64",
			media_type: "image/png",
			data: base64Data,
		}

		// Each provider should return a reasonable token count for base64 images
		expect(countImageTokens(base64ImageSource, "openai")).toBeGreaterThan(0)
		expect(countImageTokens(base64ImageSource, "anthropic")).toBeGreaterThan(0)
		expect(countImageTokens(base64ImageSource, "google")).toBeGreaterThan(0)
	})

	it("should work with different providers specified", async () => {
		const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "This is a test message" }]

		const openAIResult = await tiktoken(content, "openai")
		const anthropicResult = await tiktoken(content, "anthropic")
		const googleResult = await tiktoken(content, "google")
		const openRouterResult = await tiktoken(content, "openrouter")
		const requestyResult = await tiktoken(content, "requesty")

		// All should return reasonable token counts
		expect(openAIResult).toBeGreaterThan(0)
		expect(anthropicResult).toBeGreaterThan(0)
		expect(googleResult).toBeGreaterThan(0)
		expect(openRouterResult).toBeGreaterThan(0)
		expect(requestyResult).toBeGreaterThan(0)

		// Different providers might have different token counts due to
		// different encoders and fudge factors
		expect(
			new Set([openAIResult, anthropicResult, googleResult, openRouterResult, requestyResult]).size,
		).toBeGreaterThan(1)
	})
})
