import { describe, it, expect } from "vitest"
import {
	compressToolResult,
	shouldCompressToolResult,
	getCompressionLimitsForContextWindow,
	DEFAULT_TOOL_RESULT_CHARACTER_LIMIT,
	DEFAULT_TOOL_RESULT_LINE_LIMIT,
} from "../compressToolResult"

describe("compressToolResult", () => {
	describe("compressToolResult function", () => {
		it("should return original result when within limits", () => {
			const shortResult = "This is a short result"
			const compressed = compressToolResult(shortResult)
			expect(compressed).toBe(shortResult)
		})

		it("should return empty string for empty input", () => {
			expect(compressToolResult("")).toBe("")
			expect(compressToolResult(null as any)).toBe(null)
			expect(compressToolResult(undefined as any)).toBe(undefined)
		})

		it("should compress result when exceeding character limit", () => {
			const longResult = "A".repeat(60000) // Exceeds default 50000 char limit
			const compressed = compressToolResult(longResult)

			expect(compressed).not.toBe(longResult)
			expect(compressed.length).toBeLessThan(longResult.length)
			expect(compressed).toContain("[Tool result compressed:")
			expect(compressed).toContain("characters omitted")
		})

		it("should compress result when exceeding line limit", () => {
			const manyLines = Array(1500).fill("line").join("\n") // Exceeds default 1000 line limit
			const compressed = compressToolResult(manyLines)

			expect(compressed).not.toBe(manyLines)
			expect(compressed.split("\n").length).toBeLessThan(manyLines.split("\n").length)
			expect(compressed).toContain("[Tool result compressed:")
			expect(compressed).toContain("lines omitted")
		})

		it("should use custom limits when provided", () => {
			const result = "A".repeat(200)
			const compressed = compressToolResult(result, 100, 10) // Custom limits

			expect(compressed).not.toBe(result)
			expect(compressed).toContain("[Tool result compressed:")
		})

		it("should preserve structure with compression note at beginning", () => {
			const longResult = "A".repeat(60000)
			const compressed = compressToolResult(longResult)

			expect(compressed.startsWith("[Tool result compressed:")).toBe(true)
			expect(compressed).toContain("Original 60000 characters")
		})

		it("should handle mixed character and line limits", () => {
			// Create content that exceeds both limits
			const longLines = Array(1500).fill("A".repeat(100)).join("\n")
			const compressed = compressToolResult(longLines)

			expect(compressed).not.toBe(longLines)
			expect(compressed).toContain("[Tool result compressed:")
		})
	})

	describe("shouldCompressToolResult function", () => {
		it("should return false for short results", () => {
			const shortResult = "Short result"
			expect(shouldCompressToolResult(shortResult)).toBe(false)
		})

		it("should return true for results exceeding character limit", () => {
			const longResult = "A".repeat(60000)
			expect(shouldCompressToolResult(longResult)).toBe(true)
		})

		it("should return true for results exceeding line limit", () => {
			const manyLines = Array(1500).fill("line").join("\n")
			expect(shouldCompressToolResult(manyLines)).toBe(true)
		})

		it("should return false for empty results", () => {
			expect(shouldCompressToolResult("")).toBe(false)
			expect(shouldCompressToolResult(null as any)).toBe(false)
			expect(shouldCompressToolResult(undefined as any)).toBe(false)
		})

		it("should respect custom limits", () => {
			const result = "A".repeat(200)
			expect(shouldCompressToolResult(result, 100, 10)).toBe(true)
			expect(shouldCompressToolResult(result, 300, 10)).toBe(false)
		})
	})

	describe("getCompressionLimitsForContextWindow function", () => {
		it("should return appropriate limits for small context windows", () => {
			const limits = getCompressionLimitsForContextWindow(8000) // Small context window

			expect(limits.characterLimit).toBeGreaterThanOrEqual(DEFAULT_TOOL_RESULT_CHARACTER_LIMIT)
			expect(limits.lineLimit).toBeGreaterThanOrEqual(DEFAULT_TOOL_RESULT_LINE_LIMIT)
		})

		it("should return larger limits for large context windows", () => {
			const smallLimits = getCompressionLimitsForContextWindow(8000)
			const largeLimits = getCompressionLimitsForContextWindow(200000) // Large context window

			expect(largeLimits.characterLimit).toBeGreaterThanOrEqual(smallLimits.characterLimit)
			expect(largeLimits.lineLimit).toBeGreaterThanOrEqual(smallLimits.lineLimit)
		})

		it("should never return limits below defaults", () => {
			const limits = getCompressionLimitsForContextWindow(1000) // Very small context window

			expect(limits.characterLimit).toBeGreaterThanOrEqual(DEFAULT_TOOL_RESULT_CHARACTER_LIMIT)
			expect(limits.lineLimit).toBeGreaterThanOrEqual(DEFAULT_TOOL_RESULT_LINE_LIMIT)
		})

		it("should scale limits proportionally with context window", () => {
			const limits1 = getCompressionLimitsForContextWindow(50000)
			const limits2 = getCompressionLimitsForContextWindow(100000)

			// Larger context window should allow larger tool results
			expect(limits2.characterLimit).toBeGreaterThanOrEqual(limits1.characterLimit)
		})

		it("should cap limits at reasonable maximums", () => {
			const limits = getCompressionLimitsForContextWindow(1000000) // Extremely large context window

			// Should not exceed 2x the default limits
			expect(limits.characterLimit).toBeLessThanOrEqual(DEFAULT_TOOL_RESULT_CHARACTER_LIMIT * 2)
		})
	})

	describe("integration with truncateOutput", () => {
		it("should preserve beginning and end of content", () => {
			const longResult = "START" + "A".repeat(60000) + "END"
			const compressed = compressToolResult(longResult)

			// Should contain compression note plus truncated content
			expect(compressed).toContain("[Tool result compressed:")
			// The truncated content should preserve structure from truncateOutput
			expect(compressed).toContain("START")
			expect(compressed).toContain("END")
		})

		it("should handle line-based truncation", () => {
			const lines = Array(1500)
				.fill(0)
				.map((_, i) => `Line ${i + 1}`)
			const longResult = lines.join("\n")
			const compressed = compressToolResult(longResult)

			expect(compressed).toContain("[Tool result compressed:")
			expect(compressed).toContain("Line 1") // Should preserve beginning
			expect(compressed).toContain("lines omitted") // Should indicate truncation
		})
	})
})
