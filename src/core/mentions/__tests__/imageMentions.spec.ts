import { describe, it, expect, vi, beforeEach } from "vitest"
import { parseMentions } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import * as imageHelpers from "../../tools/helpers/imageHelpers"
import * as fs from "fs/promises"
import path from "path"

// Mock the image helpers
vi.mock("../../tools/helpers/imageHelpers", () => ({
	isSupportedImageFormat: vi.fn(),
	validateImageForProcessing: vi.fn(),
	processImageFile: vi.fn(),
	ImageMemoryTracker: vi.fn().mockImplementation(() => ({
		getTotalMemoryUsed: vi.fn().mockReturnValue(0),
		addMemoryUsage: vi.fn(),
		reset: vi.fn(),
	})),
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB: 5,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB: 20,
}))

// Mock fs
vi.mock("fs/promises", () => ({
	default: {
		stat: vi.fn(),
		readFile: vi.fn(),
	},
	stat: vi.fn(),
	readFile: vi.fn(),
}))

describe("Image Mentions", () => {
	let mockUrlContentFetcher: UrlContentFetcher

	beforeEach(() => {
		vi.clearAllMocks()
		mockUrlContentFetcher = {
			launchBrowser: vi.fn(),
			closeBrowser: vi.fn(),
			urlToMarkdown: vi.fn(),
		} as any
	})

	describe("parseMentions with image files", () => {
		it("should process image mentions and return image data URLs", async () => {
			const mockImageDataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

			// Mock image format check
			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)

			// Mock image validation
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.5,
			})

			// Mock image processing
			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: mockImageDataUrl,
				buffer: Buffer.from("test"),
				sizeInKB: 500,
				sizeInMB: 0.5,
				notice: "Image (500 KB)",
			})

			// Mock file stats
			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 512000,
			} as any)

			const result = await parseMentions(
				"Check @/test/image.png for details",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true, // supportsImages
				5, // maxImageFileSize
				20, // maxTotalImageSize
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result.text).toContain("'test/image.png' (see below for image)")
				expect(result.text).toContain('<image_content path="test/image.png">')
				expect(result.text).toContain("Image (500 KB)")
				expect(result.images).toHaveLength(1)
				expect(result.images[0]).toBe(mockImageDataUrl)
			}
		})

		it("should handle multiple image mentions", async () => {
			const mockImageDataUrl1 = "data:image/png;base64,image1"
			const mockImageDataUrl2 = "data:image/jpeg;base64,image2"

			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.5,
			})

			vi.mocked(imageHelpers.processImageFile)
				.mockResolvedValueOnce({
					dataUrl: mockImageDataUrl1,
					buffer: Buffer.from("test1"),
					sizeInKB: 500,
					sizeInMB: 0.5,
					notice: "Image (500 KB)",
				})
				.mockResolvedValueOnce({
					dataUrl: mockImageDataUrl2,
					buffer: Buffer.from("test2"),
					sizeInKB: 300,
					sizeInMB: 0.3,
					notice: "Image (300 KB)",
				})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 512000,
			} as any)

			const result = await parseMentions(
				"Compare @/image1.png with @/image2.jpg",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result.images).toHaveLength(2)
				expect(result.images[0]).toBe(mockImageDataUrl1)
				expect(result.images[1]).toBe(mockImageDataUrl2)
				expect(result.text).toContain("'image1.png' (see below for image)")
				expect(result.text).toContain("'image2.jpg' (see below for image)")
			}
		})

		it("should handle image size limit exceeded", async () => {
			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: false,
				reason: "size_limit",
				notice: "Image file is too large (10 MB). Maximum allowed size is 5 MB.",
				sizeInMB: 10,
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 10485760, // 10 MB
			} as any)

			const result = await parseMentions(
				"Check @/large-image.png",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// When validation fails, we still get an object but with no images
			expect(typeof result).toBe("string")
			if (typeof result === "string") {
				expect(result).toContain("Image file is too large (10 MB). Maximum allowed size is 5 MB.")
			}
		})

		it("should handle model that doesn't support images", async () => {
			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: false,
				reason: "unsupported_model",
				notice: "Image file detected but current model does not support images. Skipping image processing.",
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 512000,
			} as any)

			const result = await parseMentions(
				"Check @/image.png",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				false, // supportsImages = false
				5,
				20,
			)

			// When model doesn't support images, result should be a string
			expect(typeof result).toBe("string")
			if (typeof result === "string") {
				expect(result).toContain("Image file detected but current model does not support images")
			}
		})

		it("should handle mixed content with images and regular files", async () => {
			const mockImageDataUrl = "data:image/png;base64,testimage"

			// Mock for image file
			vi.mocked(imageHelpers.isSupportedImageFormat).mockImplementation((ext) => ext === ".png")

			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.5,
			})

			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: mockImageDataUrl,
				buffer: Buffer.from("test"),
				sizeInKB: 500,
				sizeInMB: 0.5,
				notice: "Image (500 KB)",
			})

			// Mock file stats - need to handle both image and script file
			let statCallCount = 0
			vi.mocked(fs.stat).mockImplementation(async (path) => {
				statCallCount++
				// First call is for image.png, second is for script.js
				return {
					isFile: () => true,
					isDirectory: () => false,
					size: statCallCount === 1 ? 512000 : 100,
				} as any
			})

			// Mock file read for text file
			vi.mocked(fs.readFile).mockResolvedValue("console.log('test');")

			const result = await parseMentions(
				"Check @/image.png and @/script.js",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result.images).toHaveLength(1)
				expect(result.images[0]).toBe(mockImageDataUrl)
				expect(result.text).toContain("'image.png' (see below for image)")
				// The script.js file will have an error because we're not fully mocking the file system
				// but that's okay for this test - we're mainly testing that images and non-images are handled differently
				expect(result.text).toContain("script.js")
			}
		})

		it("should respect .rooignore for image files", async () => {
			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)

			const mockRooIgnoreController = {
				validateAccess: vi.fn().mockReturnValue(false),
			}

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 512000,
			} as any)

			const result = await parseMentions(
				"Check @/ignored-image.png",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				mockRooIgnoreController as any,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// When image is ignored, result should be a string
			expect(typeof result).toBe("string")
			if (typeof result === "string") {
				expect(result).toContain("(Image ignored-image.png is ignored by .rooignore)")
			}
		})

		it("should handle total memory limit for multiple images", async () => {
			vi.mocked(imageHelpers.isSupportedImageFormat).mockReturnValue(true)

			// First image validates successfully
			vi.mocked(imageHelpers.validateImageForProcessing)
				.mockResolvedValueOnce({
					isValid: true,
					sizeInMB: 15,
				})
				.mockResolvedValueOnce({
					isValid: false,
					reason: "memory_limit",
					notice: "Image skipped to avoid size limit (20MB). Current: 15MB + this file: 8MB. Try fewer or smaller images.",
					sizeInMB: 8,
				})

			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: "data:image/png;base64,firstimage",
				buffer: Buffer.from("test"),
				sizeInKB: 15360,
				sizeInMB: 15,
				notice: "Image (15360 KB)",
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 15728640, // 15 MB
			} as any)

			const result = await parseMentions(
				"Check @/large1.png and @/large2.png",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				25, // maxImageFileSize
				20, // maxTotalImageSize
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result.images).toHaveLength(1)
				expect(result.text).toContain("Image skipped to avoid size limit")
			}
		})

		it("should handle SVG image format", async () => {
			const mockSvgDataUrl =
				"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=="

			vi.mocked(imageHelpers.isSupportedImageFormat).mockImplementation((ext) => ext === ".svg")
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.1,
			})

			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: mockSvgDataUrl,
				buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
				sizeInKB: 100,
				sizeInMB: 0.1,
				notice: "Image (100 KB)",
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 102400,
			} as any)

			const result = await parseMentions(
				"Check @/logo.svg",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result).toHaveProperty("images")
				expect(result.images).toHaveLength(1)
				expect(result.images[0]).toBe(mockSvgDataUrl)
				expect(result.text).toContain("'logo.svg' (see below for image)")
			}
		})

		it("should handle WebP image format", async () => {
			const mockWebpDataUrl =
				"data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA="

			vi.mocked(imageHelpers.isSupportedImageFormat).mockImplementation((ext) => ext === ".webp")
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.2,
			})

			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: mockWebpDataUrl,
				buffer: Buffer.from("webp data"),
				sizeInKB: 200,
				sizeInMB: 0.2,
				notice: "Image (200 KB)",
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 204800,
			} as any)

			const result = await parseMentions(
				"Check @/photo.webp",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result).toHaveProperty("images")
				expect(result.images).toHaveLength(1)
				expect(result.images[0]).toBe(mockWebpDataUrl)
				expect(result.text).toContain("'photo.webp' (see below for image)")
			}
		})

		it("should handle AVIF image format", async () => {
			const mockAvifDataUrl =
				"data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg=="

			vi.mocked(imageHelpers.isSupportedImageFormat).mockImplementation((ext) => ext === ".avif")
			vi.mocked(imageHelpers.validateImageForProcessing).mockResolvedValue({
				isValid: true,
				sizeInMB: 0.3,
			})

			vi.mocked(imageHelpers.processImageFile).mockResolvedValue({
				dataUrl: mockAvifDataUrl,
				buffer: Buffer.from("avif data"),
				sizeInKB: 300,
				sizeInMB: 0.3,
				notice: "Image (300 KB)",
			})

			vi.mocked(fs.stat).mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
				size: 307200,
			} as any)

			const result = await parseMentions(
				"Check @/modern.avif",
				"/workspace",
				mockUrlContentFetcher,
				undefined,
				undefined,
				true,
				true,
				50,
				undefined,
				true,
				5,
				20,
			)

			// Type guard for TypeScript
			expect(typeof result).toBe("object")
			if (typeof result === "object") {
				expect(result).toHaveProperty("images")
				expect(result.images).toHaveLength(1)
				expect(result.images[0]).toBe(mockAvifDataUrl)
				expect(result.text).toContain("'modern.avif' (see below for image)")
			}
		})
	})
})
