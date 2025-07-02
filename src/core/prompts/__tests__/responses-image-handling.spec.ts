// npx vitest core/prompts/__tests__/responses-image-handling.spec.ts

import { vi, describe, it, expect } from "vitest"
import { formatResponse } from "../responses"

// Mock VSCode dependencies
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	return {
		workspace: {
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
		},
		RelativePattern: vi.fn(),
	}
})

// Mock fs dependencies
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("fs/promises", () => ({
	readFile: vi.fn().mockResolvedValue(""),
}))

describe("Image Handling in formatResponse", () => {
	describe("formatResponse.toolResult with images", () => {
		it("should handle standard data URI format images", () => {
			const text = "Here is an image:"
			const images = [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			]

			const result = formatResponse.toolResult(text, images)

			// Should return an array with text and image blocks
			expect(Array.isArray(result)).toBe(true)
			const resultArray = result as any[]

			// First block should be text
			expect(resultArray[0]).toEqual({
				type: "text",
				text: "Here is an image:",
			})

			// Second block should be image with correct format
			expect(resultArray[1]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
				},
			})
		})

		it("should handle raw base64 data without data URI prefix", () => {
			const text = "Here is an image:"
			const images = [
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			]

			const result = formatResponse.toolResult(text, images)

			// Should return an array with text and image blocks
			expect(Array.isArray(result)).toBe(true)
			const resultArray = result as any[]

			// First block should be text
			expect(resultArray[0]).toEqual({
				type: "text",
				text: "Here is an image:",
			})

			// Second block should be image with default PNG mime type
			expect(resultArray[1]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png", // Default fallback
					data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
				},
			})
		})

		it("should handle different image MIME types in data URI", () => {
			const text = "Here are different image types:"
			const images = [
				"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A",
				"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				"data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
			]

			const result = formatResponse.toolResult(text, images)

			// Should return an array with text and image blocks
			expect(Array.isArray(result)).toBe(true)
			const resultArray = result as any[]

			// First block should be text
			expect(resultArray[0]).toEqual({
				type: "text",
				text: "Here are different image types:",
			})

			// Should handle JPEG
			expect(resultArray[1]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/jpeg",
					data: "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A",
				},
			})

			// Should handle GIF
			expect(resultArray[2]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/gif",
					data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				},
			})

			// Should handle WebP
			expect(resultArray[3]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/webp",
					data: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
				},
			})
		})

		it("should handle mixed data URI and raw base64 images", () => {
			const text = "Mixed image formats:"
			const images = [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
				"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", // Raw base64 GIF
			]

			const result = formatResponse.toolResult(text, images)

			// Should return an array with text and image blocks
			expect(Array.isArray(result)).toBe(true)
			const resultArray = result as any[]

			// First image should preserve original PNG format
			expect(resultArray[1]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
				},
			})

			// Second image should default to PNG for raw base64
			expect(resultArray[2]).toEqual({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png", // Default fallback
					data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				},
			})
		})

		it("should return just text when no images provided", () => {
			const text = "Just text, no images"

			const result = formatResponse.toolResult(text)

			// Should return just the text string
			expect(result).toBe("Just text, no images")
		})

		it("should return just text when empty images array provided", () => {
			const text = "Just text, empty images array"
			const images: string[] = []

			const result = formatResponse.toolResult(text, images)

			// Should return just the text string
			expect(result).toBe("Just text, empty images array")
		})
	})

	describe("formatResponse.imageBlocks", () => {
		it("should handle undefined images", () => {
			const result = formatResponse.imageBlocks(undefined)

			expect(result).toEqual([])
		})

		it("should handle empty images array", () => {
			const result = formatResponse.imageBlocks([])

			expect(result).toEqual([])
		})

		it("should format raw base64 images correctly", () => {
			const images = [
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			]

			const result = formatResponse.imageBlocks(images)

			expect(result).toEqual([
				{
					type: "image",
					source: {
						type: "base64",
						media_type: "image/png",
						data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
					},
				},
			])
		})
	})
})
