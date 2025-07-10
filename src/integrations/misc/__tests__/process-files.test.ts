import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"
import { selectFiles, selectImages } from "../process-files"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showOpenDialog: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	Uri: {
		file: (path: string) => ({ fsPath: path }),
	},
}))

// Mock fs
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		stat: vi.fn(),
	},
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

		it("should process image files correctly", async () => {
			const mockUri = { fsPath: "/test/image.png" }
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake-image-data"))

			const result = await selectFiles()

			expect(result.images).toHaveLength(1)
			expect(result.images[0]).toMatch(/^data:image\/png;base64,/)
			expect(result.files).toHaveLength(0)
		})

		it("should process text files correctly", async () => {
			const mockUri = { fsPath: "/test/data.json" }
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
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
				{ fsPath: "/test/image.jpg" },
				{ fsPath: "/test/config.xml" },
				{ fsPath: "/test/readme.md" },
			]
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(mockUris as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(fs.readFile)
				.mockResolvedValueOnce(Buffer.from("fake-image"))
				.mockResolvedValueOnce("<config>test</config>")
				.mockResolvedValueOnce("# README")

			const result = await selectFiles()

			expect(result.images).toHaveLength(1)
			expect(result.files).toHaveLength(2)
			expect(result.files[0].type).toBe("xml")
			expect(result.files[1].type).toBe("md")
		})

		it("should reject files that are too large", async () => {
			const mockUri = { fsPath: "/test/large.txt" }
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 25 * 1024 * 1024 } as any) // 25MB

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("File too large: large.txt (max 20MB)")
			expect(result).toEqual({ images: [], files: [] })
		})

		it("should handle binary files gracefully", async () => {
			const mockUri = { fsPath: "/test/binary.exe" }
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri] as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("Invalid UTF-8"))

			const result = await selectFiles()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Cannot attach binary file: binary.exe")
			expect(result).toEqual({ images: [], files: [] })
		})
	})

	describe("selectImages", () => {
		it("should only return images from selectFiles", async () => {
			const mockUris = [{ fsPath: "/test/image.png" }, { fsPath: "/test/data.json" }]
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(mockUris as any)
			vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any)
			vi.mocked(fs.readFile)
				.mockResolvedValueOnce(Buffer.from("fake-image"))
				.mockResolvedValueOnce('{"test": "data"}')

			const result = await selectImages()

			expect(result).toHaveLength(1)
			expect(result[0]).toMatch(/^data:image\/png;base64,/)
		})
	})
})
