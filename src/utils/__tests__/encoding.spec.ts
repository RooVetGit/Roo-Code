import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as jschardet from "jschardet"
import * as iconv from "iconv-lite"
import { isBinaryFile } from "isbinaryfile"
import fs from "fs/promises"
import path from "path"
import {
	detectEncoding,
	readFileWithEncodingDetection,
	detectFileEncoding,
	writeFileWithEncodingPreservation,
} from "../encoding"

// Mock dependencies
vi.mock("jschardet", () => ({
	detect: vi.fn()
}))

vi.mock("iconv-lite", () => ({
	encodingExists: vi.fn(),
	decode: vi.fn(),
	encode: vi.fn()
}))

vi.mock("isbinaryfile", () => ({
	isBinaryFile: vi.fn()
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn()
	}
}))

vi.mock("path", () => ({
	default: {
		extname: vi.fn()
	}
}))

const mockJschardet = vi.mocked(jschardet)
const mockIconv = vi.mocked(iconv)
const mockIsBinaryFile = vi.mocked(isBinaryFile)
const mockFs = vi.mocked(fs)
const mockPath = vi.mocked(path)

describe("encoding", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset default mocks
		mockPath.extname.mockReturnValue(".txt")
		mockIconv.encodingExists.mockReturnValue(true)
		mockIconv.decode.mockReturnValue("decoded content")
		mockIconv.encode.mockReturnValue(Buffer.from("encoded content"))
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("detectEncoding", () => {
		it("should throw error for binary files", async () => {
			const buffer = Buffer.from("binary content")
			mockIsBinaryFile.mockResolvedValue(true)

			await expect(detectEncoding(buffer, ".exe")).rejects.toThrow(
				"Cannot read text for file type: .exe"
			)
		})

		it("should handle string detection result from jschardet", async () => {
			const buffer = Buffer.from("utf8 content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9
			})

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("utf8")
		})

		it("should handle object detection result with high confidence", async () => {
			const buffer = Buffer.from("gbk content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9,
			})

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("gbk")
		})

		it("should handle ISO-8859-1 encoding", async () => {
			const buffer = Buffer.from("iso-8859-1 content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "iso-8859-1",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(true)

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("iso-8859-1")
		})

		it("should handle Shift-JIS encoding", async () => {
			const buffer = Buffer.from("shift-jis content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "shift-jis",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(true)

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("shift-jis")
		})

		it("should handle empty file gracefully", async () => {
			const buffer = Buffer.alloc(0)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"No encoding detected, falling back to utf8"
			)
		})

		it("should handle very small file (1 byte)", async () => {
			const buffer = Buffer.from("a")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"No encoding detected, falling back to utf8"
			)
		})

		it("should handle very small file (2 bytes)", async () => {
			const buffer = Buffer.from("ab")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.3
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"Low confidence encoding detection: utf8 (confidence: 0.3), falling back to utf8"
			)
		})

		it("should fallback to utf8 for low confidence detection", async () => {
			const buffer = Buffer.from("uncertain content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.5,
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"Low confidence encoding detection: gbk (confidence: 0.5), falling back to utf8"
			)
		})

		it("should fallback to utf8 when no encoding detected", async () => {
			const buffer = Buffer.from("no encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "",
				confidence: 0
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"No encoding detected, falling back to utf8"
			)
		})

		it("should fallback to utf8 for unsupported encodings", async () => {
			const buffer = Buffer.from("unsupported encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "unsupported-encoding",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(false)

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const result = await detectEncoding(buffer, ".txt")

			expect(result).toBe("utf8")
			expect(consoleSpy).toHaveBeenCalledWith(
				"Unsupported encoding detected: unsupported-encoding, falling back to utf8"
			)
		})

		it("should handle unsupported encoding with original detection info", async () => {
			const buffer = Buffer.from("unsupported encoding content")
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "unsupported-encoding",
				confidence: 0.9,
			})
			mockIconv.encodingExists.mockReturnValue(false)

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			await detectEncoding(buffer, ".txt")

			expect(consoleSpy).toHaveBeenCalledWith(
				"Unsupported encoding detected: unsupported-encoding, falling back to utf8"
			)
		})

		it("should handle isBinaryFile error gracefully", async () => {
			const buffer = Buffer.from("content")
			mockIsBinaryFile.mockRejectedValue(new Error("Detection failed"))

			const result = await detectEncoding(buffer, ".txt")
			expect(result).toBe("utf8") // Should fallback to utf8
		})
	})

	describe("readFileWithEncodingDetection", () => {
		it("should read file and detect encoding correctly", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("file content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9
			})

			const result = await readFileWithEncodingDetection(filePath)

			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
			expect(mockPath.extname).toHaveBeenCalledWith(filePath)
			expect(mockIconv.decode).toHaveBeenCalledWith(buffer, "utf8")
			expect(result).toBe("decoded content")
		})

		it("should handle binary file detection", async () => {
			const filePath = "/path/to/file.exe"
			const buffer = Buffer.from("binary content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(true)
			mockPath.extname.mockReturnValue(".exe")

			await expect(readFileWithEncodingDetection(filePath)).rejects.toThrow(
				"Cannot read text for file type: .exe"
			)
		})
	})

	describe("detectFileEncoding", () => {
		it("should detect encoding for existing file", async () => {
			const filePath = "/path/to/file.txt"
			const buffer = Buffer.from("file content")
			mockFs.readFile.mockResolvedValue(buffer)
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9
			})

			const result = await detectFileEncoding(filePath)

			expect(mockFs.readFile).toHaveBeenCalledWith(filePath)
			expect(result).toBe("gbk")
		})

		it("should return utf8 for non-existent file", async () => {
			const filePath = "/path/to/nonexistent.txt"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			const result = await detectFileEncoding(filePath)

			expect(result).toBe("utf8")
		})

		it("should return utf8 for unreadable file", async () => {
			const filePath = "/path/to/unreadable.txt"
			mockFs.readFile.mockRejectedValue(new Error("Permission denied"))

			const result = await detectFileEncoding(filePath)

			expect(result).toBe("utf8")
		})
	})

	describe("writeFileWithEncodingPreservation", () => {
		it("should write utf8 file directly when original is utf8", async () => {
			const filePath = "/path/to/file.txt"
			const content = "new content"
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "utf8",
				confidence: 0.9
			})

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, "utf8")
		})

		it("should convert and write content for non-utf8 encoding", async () => {
			const filePath = "/path/to/file.txt"
			const content = "new content"
			mockIsBinaryFile.mockResolvedValue(false)
			mockJschardet.detect.mockReturnValue({
				encoding: "gbk",
				confidence: 0.9
			})

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockIconv.encode).toHaveBeenCalledWith(content, "gbk")
			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, Buffer.from("encoded content"))
		})

		it("should handle new file (utf8) correctly", async () => {
			const filePath = "/path/to/newfile.txt"
			const content = "new content"
			mockFs.readFile.mockRejectedValue(new Error("File not found"))

			await writeFileWithEncodingPreservation(filePath, content)

			expect(mockFs.writeFile).toHaveBeenCalledWith(filePath, content, "utf8")
		})
	})
}) 