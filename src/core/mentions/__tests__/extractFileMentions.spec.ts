import { describe, it, expect } from "vitest"
import { extractFileMentions, hasFileMentions } from "../extractFileMentions"

describe("extractFileMentions", () => {
	it("should extract single file mention", () => {
		const text = "Please analyze @/src/main.ts and provide feedback"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(1)
		expect(mentions[0]).toEqual({
			mention: "@/src/main.ts",
			path: "src/main.ts",
		})
	})

	it("should extract multiple file mentions", () => {
		const text = "Compare @/src/index.ts with @/src/utils.ts and @/tests/main.spec.ts"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(3)
		expect(mentions[0].path).toBe("src/index.ts")
		expect(mentions[1].path).toBe("src/utils.ts")
		expect(mentions[2].path).toBe("tests/main.spec.ts")
	})

	it("should not extract folder mentions", () => {
		const text = "Check the @/src/ folder and @/src/file.ts"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(1)
		expect(mentions[0].path).toBe("src/file.ts")
	})

	it("should not extract non-file mentions", () => {
		const text = "Check @problems and @terminal output"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(0)
	})

	it("should handle mentions with escaped spaces", () => {
		const text = "Read @/path/to/file\\ with\\ spaces.txt"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(1)
		expect(mentions[0].path).toBe("path/to/file\\ with\\ spaces.txt")
	})

	it("should return empty array for text without mentions", () => {
		const text = "This is just regular text without any mentions"
		const mentions = extractFileMentions(text)

		expect(mentions).toHaveLength(0)
	})
})

describe("hasFileMentions", () => {
	it("should return true when content has file mentions", () => {
		const content = [{ type: "text", text: "Check @/src/main.ts" }]

		expect(hasFileMentions(content)).toBe(true)
	})

	it("should return false when content has no file mentions", () => {
		const content = [{ type: "text", text: "Just regular text" }]

		expect(hasFileMentions(content)).toBe(false)
	})

	it("should return false for non-file mentions", () => {
		const content = [{ type: "text", text: "Check @problems and @terminal" }]

		expect(hasFileMentions(content)).toBe(false)
	})

	it("should check multiple content blocks", () => {
		const content = [
			{ type: "text", text: "First block without mentions" },
			{ type: "text", text: "Second block with @/src/file.ts" },
			{ type: "image", text: undefined },
		]

		expect(hasFileMentions(content)).toBe(true)
	})

	it("should handle content blocks without text", () => {
		const content = [{ type: "image" }, { type: "text", text: undefined }, { type: "text", text: "" }]

		expect(hasFileMentions(content)).toBe(false)
	})
})
