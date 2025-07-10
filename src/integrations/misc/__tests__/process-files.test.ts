import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"
import { selectFiles, selectImages, convertImageReferencesToDataUrls } from "../process-files"
import { getMimeType, isImageExtension } from "../../../utils/mimeTypes"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showOpenDialog: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	Uri: {
		file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
		parse: (uri: string) => ({ fsPath: uri.replace("file://", "") }),
	},
}))

// Mock fs
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		stat: vi.fn(),
	},
}))

// Mock mimeTypes utils
vi.mock("../../../utils/mimeTypes", () => ({
	getMimeType: vi.fn(),
	isImageExtension: vi.fn(),
}))

describe("process-files", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("selectFiles", () => {
		it("should return empty arrays when no files are selected", async () => {
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(undefined)

			const result = await selectFiles()

			expect(result).toEqual({ images: [], files: [] })
		})

		it("should process image files correctly with references", async () => {
			const mockUri = {
				fsPath: "/test/image.png",
				toString: () => "file:///test/image.png",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValue(true)
			vi.mocked(getMimeType).mockReturnValue("image/png")

			const result = await selectFiles()

			expect(result.images).toHaveLength(1)
			expect(result.images[0]).toEqual({
				path: "image.png",
				uri: "file:///test/image.png",
				size: 1000,
				mimeType: "image/png",
			})
			expect(result.files).toHaveLength(0)
		})

		it("should process text files correctly", async () => {
			const mockUri = {
				fsPath: "/test/data.json",
				toString: () => "file:///test/data.json",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValue(false)
			vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}')

			const result = await selectFiles()

			expect(result.files).toHaveLength(1)
			expect(result.files[0]).toEqual({
				path: "data.json",
				content: '{"test": "data"}',
				type: "json",
			})
			expect(result.images).toHaveLength(0)
		})

		it("should handle multiple files of different types", async () => {
			const mockUris = [
				{ fsPath: "/test/image.jpg", toString: () => "file:///test/image.jpg" },
				{ fsPath: "/test/config.xml", toString: () => "file:///test/config.xml" },
				{ fsPath: "/test/readme.md", toString: () => "file:///test/readme.md" },
			]
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(mockUris as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(false)
			vi.mocked(getMimeType).mockReturnValue("image/jpeg")
			vi.mocked(fs.readFile).mockResolvedValueOnce("<config>test</config>").mockResolvedValueOnce("# README")

			const result = await selectFiles()

			expect(result.images).toHaveLength(1)
			expect(result.files).toHaveLength(2)
			expect(result.files[0].type).toBe("xml")
			expect(result.files[1].type).toBe("md")
		})

		it("should reject files that are too large", async () => {
			const mockUri = {
				fsPath: "/test/large.txt",
				toString: () => "file:///test/large.txt",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 25 * 1024 * 1024 } as any) // 25MB

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("File too large: large.txt (max 20MB)")
			expect(result).toEqual({ images: [], files: [] })
		})

		it("should handle binary files gracefully", async () => {
			const mockUri = {
				fsPath: "/test/binary.exe",
				toString: () => "file:///test/binary.exe",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValue(false)

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Cannot attach binary file: binary.exe")
			expect(result).toEqual({ images: [], files: [] })
		})

		it("should detect binary content in text files", async () => {
			const mockUri = {
				fsPath: "/test/fake-text.txt",
				toString: () => "file:///test/fake-text.txt",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValue(false)
			vi.mocked(fs.readFile).mockResolvedValue("text with \0 null byte")

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("File appears to be binary: fake-text.txt")
			expect(result).toEqual({ images: [], files: [] })
		})

		it("should handle file read errors", async () => {
			const mockUri = {
				fsPath: "/test/unreadable.txt",
				toString: () => "file:///test/unreadable.txt",
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValue(false)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("Permission denied"))

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Cannot read file as text: unreadable.txt")
			expect(result).toEqual({ images: [], files: [] })
		})
	})

	describe("convertImageReferencesToDataUrls", () => {
		it("should convert image references to data URLs", async () => {
			const imageRefs = [
				{
					path: "image1.png",
					uri: "file:///test/image1.png",
					size: 1000,
					mimeType: "image/png",
				},
				{
					path: "image2.jpg",
					uri: "file:///test/image2.jpg",
					size: 2000,
					mimeType: "image/jpeg",
				},
			]

			vi.mocked(fs.readFile)
				.mockResolvedValueOnce(Buffer.from("fake-png-data"))
				.mockResolvedValueOnce(Buffer.from("fake-jpg-data"))

			const result = await convertImageReferencesToDataUrls(imageRefs)

			expect(result).toHaveLength(2)
			expect(result[0]).toBe("data:image/png;base64,ZmFrZS1wbmctZGF0YQ==")
			expect(result[1]).toBe("data:image/jpeg;base64,ZmFrZS1qcGctZGF0YQ==")
		})

		it("should handle errors when converting images", async () => {
			const imageRefs = [
				{
					path: "missing.png",
					uri: "file:///test/missing.png",
					size: 1000,
					mimeType: "image/png",
				},
			]

			vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))

			const result = await convertImageReferencesToDataUrls(imageRefs)

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Failed to read image: missing.png")
			expect(result).toEqual([])
		})
	})

	describe("selectImages", () => {
		it("should only return images from selectFiles as data URLs", async () => {
			const mockUris = [
				{ fsPath: "/test/image.png", toString: () => "file:///test/image.png" },
				{ fsPath: "/test/data.json", toString: () => "file:///test/data.json" },
			]
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(mockUris as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(isImageExtension).mockReturnValueOnce(true).mockReturnValueOnce(false)
			vi.mocked(getMimeType).mockReturnValue("image/png")
			// First call for text file read attempt, second for image conversion
			vi.mocked(fs.readFile)
				.mockResolvedValueOnce('{"test": "data"}')
				.mockResolvedValueOnce(Buffer.from("fake-image"))

			const result = await selectImages()

			expect(result).toHaveLength(1)
			expect(result[0]).toBe("data:image/png;base64,ZmFrZS1pbWFnZQ==")
		})
	})
})
