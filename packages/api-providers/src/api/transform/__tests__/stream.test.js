describe("API Stream Types", () => {
	describe("ApiStreamChunk", () => {
		it("should correctly handle text chunks", () => {
			const textChunk = {
				type: "text",
				text: "Hello world",
			}
			expect(textChunk.type).toBe("text")
			expect(textChunk.text).toBe("Hello world")
		})
		it("should correctly handle usage chunks with cache information", () => {
			const usageChunk = {
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheWriteTokens: 20,
				cacheReadTokens: 10,
			}
			expect(usageChunk.type).toBe("usage")
			expect(usageChunk.inputTokens).toBe(100)
			expect(usageChunk.outputTokens).toBe(50)
			expect(usageChunk.cacheWriteTokens).toBe(20)
			expect(usageChunk.cacheReadTokens).toBe(10)
		})
		it("should handle usage chunks without cache tokens", () => {
			const usageChunk = {
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
			}
			expect(usageChunk.type).toBe("usage")
			expect(usageChunk.inputTokens).toBe(100)
			expect(usageChunk.outputTokens).toBe(50)
			expect(usageChunk.cacheWriteTokens).toBeUndefined()
			expect(usageChunk.cacheReadTokens).toBeUndefined()
		})
		it("should handle text chunks with empty strings", () => {
			const emptyTextChunk = {
				type: "text",
				text: "",
			}
			expect(emptyTextChunk.type).toBe("text")
			expect(emptyTextChunk.text).toBe("")
		})
		it("should handle usage chunks with zero tokens", () => {
			const zeroUsageChunk = {
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
			}
			expect(zeroUsageChunk.type).toBe("usage")
			expect(zeroUsageChunk.inputTokens).toBe(0)
			expect(zeroUsageChunk.outputTokens).toBe(0)
		})
		it("should handle usage chunks with large token counts", () => {
			const largeUsageChunk = {
				type: "usage",
				inputTokens: 1000000,
				outputTokens: 500000,
				cacheWriteTokens: 200000,
				cacheReadTokens: 100000,
			}
			expect(largeUsageChunk.type).toBe("usage")
			expect(largeUsageChunk.inputTokens).toBe(1000000)
			expect(largeUsageChunk.outputTokens).toBe(500000)
			expect(largeUsageChunk.cacheWriteTokens).toBe(200000)
			expect(largeUsageChunk.cacheReadTokens).toBe(100000)
		})
		it("should handle text chunks with special characters", () => {
			const specialCharsChunk = {
				type: "text",
				text: "!@#$%^&*()_+-=[]{}|;:,.<>?`~",
			}
			expect(specialCharsChunk.type).toBe("text")
			expect(specialCharsChunk.text).toBe("!@#$%^&*()_+-=[]{}|;:,.<>?`~")
		})
		it("should handle text chunks with unicode characters", () => {
			const unicodeChunk = {
				type: "text",
				text: "你好世界👋🌍",
			}
			expect(unicodeChunk.type).toBe("text")
			expect(unicodeChunk.text).toBe("你好世界👋🌍")
		})
		it("should handle text chunks with multiline content", () => {
			const multilineChunk = {
				type: "text",
				text: "Line 1\nLine 2\nLine 3",
			}
			expect(multilineChunk.type).toBe("text")
			expect(multilineChunk.text).toBe("Line 1\nLine 2\nLine 3")
			expect(multilineChunk.text.split("\n")).toHaveLength(3)
		})
	})
})
export {}
//# sourceMappingURL=stream.test.js.map
