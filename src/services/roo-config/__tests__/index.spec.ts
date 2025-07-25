import * as path from "path"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockStat, mockReadFile, mockHomedir, mockConsoleWarn } = vi.hoisted(() => ({
	mockStat: vi.fn(),
	mockReadFile: vi.fn(),
	mockHomedir: vi.fn(),
	mockConsoleWarn: vi.fn(),
}))

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	default: {
		stat: mockStat,
		readFile: mockReadFile,
	},
}))

// Mock os module
vi.mock("os", () => ({
	homedir: mockHomedir,
}))

import {
	getGlobalRooDirectory,
	getProjectRooDirectoryForCwd,
	directoryExists,
	fileExists,
	readFileIfExists,
	getRooDirectoriesForCwd,
	loadConfiguration,
} from "../index"
import { MAX_CONFIG_FILE_SIZE_BYTES } from "../../constants/file-limits"

describe("RooConfigService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockHomedir.mockReturnValue("/mock/home")
		// Mock console.warn
		console.warn = mockConsoleWarn
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getGlobalRooDirectory", () => {
		it("should return correct path for global .roo directory", () => {
			const result = getGlobalRooDirectory()
			expect(result).toBe(path.join("/mock/home", ".roo"))
		})

		it("should handle different home directories", () => {
			mockHomedir.mockReturnValue("/different/home")
			const result = getGlobalRooDirectory()
			expect(result).toBe(path.join("/different/home", ".roo"))
		})
	})

	describe("getProjectRooDirectoryForCwd", () => {
		it("should return correct path for given cwd", () => {
			const cwd = "/custom/project/path"
			const result = getProjectRooDirectoryForCwd(cwd)
			expect(result).toBe(path.join(cwd, ".roo"))
		})
	})

	describe("directoryExists", () => {
		it("should return true for existing directory", async () => {
			mockStat.mockResolvedValue({ isDirectory: () => true } as any)

			const result = await directoryExists("/some/path")

			expect(result).toBe(true)
			expect(mockStat).toHaveBeenCalledWith("/some/path")
		})

		it("should return false for non-existing path", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			mockStat.mockRejectedValue(error)

			const result = await directoryExists("/non/existing/path")

			expect(result).toBe(false)
		})

		it("should return false for ENOTDIR error", async () => {
			const error = new Error("ENOTDIR") as any
			error.code = "ENOTDIR"
			mockStat.mockRejectedValue(error)

			const result = await directoryExists("/not/a/directory")

			expect(result).toBe(false)
		})

		it("should throw unexpected errors", async () => {
			const error = new Error("Permission denied") as any
			error.code = "EACCES"
			mockStat.mockRejectedValue(error)

			await expect(directoryExists("/permission/denied")).rejects.toThrow("Permission denied")
		})

		it("should return false for files", async () => {
			mockStat.mockResolvedValue({ isDirectory: () => false } as any)

			const result = await directoryExists("/some/file.txt")

			expect(result).toBe(false)
		})
	})

	describe("fileExists", () => {
		it("should return true for existing file", async () => {
			mockStat.mockResolvedValue({ isFile: () => true } as any)

			const result = await fileExists("/some/file.txt")

			expect(result).toBe(true)
			expect(mockStat).toHaveBeenCalledWith("/some/file.txt")
		})

		it("should return false for non-existing file", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			mockStat.mockRejectedValue(error)

			const result = await fileExists("/non/existing/file.txt")

			expect(result).toBe(false)
		})

		it("should return false for ENOTDIR error", async () => {
			const error = new Error("ENOTDIR") as any
			error.code = "ENOTDIR"
			mockStat.mockRejectedValue(error)

			const result = await fileExists("/not/a/directory/file.txt")

			expect(result).toBe(false)
		})

		it("should throw unexpected errors", async () => {
			const error = new Error("Permission denied") as any
			error.code = "EACCES"
			mockStat.mockRejectedValue(error)

			await expect(fileExists("/permission/denied/file.txt")).rejects.toThrow("Permission denied")
		})

		it("should return false for directories", async () => {
			mockStat.mockResolvedValue({ isFile: () => false } as any)

			const result = await fileExists("/some/directory")

			expect(result).toBe(false)
		})
	})

	describe("readFileIfExists", () => {
		it("should return file content for existing file within size limit", async () => {
			mockStat.mockResolvedValue({ size: 1024 }) // 1KB, well under limit
			mockReadFile.mockResolvedValue("file content")

			const result = await readFileIfExists("/some/file.txt")

			expect(result).toBe("file content")
			expect(mockStat).toHaveBeenCalledWith("/some/file.txt")
			expect(mockReadFile).toHaveBeenCalledWith("/some/file.txt", "utf-8")
		})

		it("should return null for file exceeding size limit", async () => {
			const largeSize = MAX_CONFIG_FILE_SIZE_BYTES + 1
			mockStat.mockResolvedValue({ size: largeSize })

			const result = await readFileIfExists("/large/file.txt")

			expect(result).toBe(null)
			expect(mockStat).toHaveBeenCalledWith("/large/file.txt")
			expect(mockReadFile).not.toHaveBeenCalled()
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				`File /large/file.txt exceeds size limit (${largeSize} bytes > ${MAX_CONFIG_FILE_SIZE_BYTES} bytes)`,
			)
		})

		it("should return file content for file exactly at size limit", async () => {
			mockStat.mockResolvedValue({ size: MAX_CONFIG_FILE_SIZE_BYTES })
			mockReadFile.mockResolvedValue("file content at limit")

			const result = await readFileIfExists("/exact/limit/file.txt")

			expect(result).toBe("file content at limit")
			expect(mockStat).toHaveBeenCalledWith("/exact/limit/file.txt")
			expect(mockReadFile).toHaveBeenCalledWith("/exact/limit/file.txt", "utf-8")
		})

		it("should return null for non-existing file", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			mockStat.mockRejectedValue(error)

			const result = await readFileIfExists("/non/existing/file.txt")

			expect(result).toBe(null)
			expect(mockReadFile).not.toHaveBeenCalled()
		})

		it("should return null for ENOTDIR error", async () => {
			const error = new Error("ENOTDIR") as any
			error.code = "ENOTDIR"
			mockStat.mockRejectedValue(error)

			const result = await readFileIfExists("/not/a/directory/file.txt")

			expect(result).toBe(null)
			expect(mockReadFile).not.toHaveBeenCalled()
		})

		it("should return null for EISDIR error", async () => {
			const error = new Error("EISDIR") as any
			error.code = "EISDIR"
			mockStat.mockRejectedValue(error)

			const result = await readFileIfExists("/is/a/directory")

			expect(result).toBe(null)
			expect(mockReadFile).not.toHaveBeenCalled()
		})

		it("should throw unexpected errors from stat", async () => {
			const error = new Error("Permission denied") as any
			error.code = "EACCES"
			mockStat.mockRejectedValue(error)

			await expect(readFileIfExists("/permission/denied/file.txt")).rejects.toThrow("Permission denied")
			expect(mockReadFile).not.toHaveBeenCalled()
		})

		it("should throw unexpected errors from readFile", async () => {
			mockStat.mockResolvedValue({ size: 1024 }) // Within limit
			const error = new Error("Read error") as any
			error.code = "EIO"
			mockReadFile.mockRejectedValue(error)

			await expect(readFileIfExists("/io/error/file.txt")).rejects.toThrow("Read error")
		})
	})

	describe("getRooDirectoriesForCwd", () => {
		it("should return directories for given cwd", () => {
			const cwd = "/custom/project/path"

			const result = getRooDirectoriesForCwd(cwd)

			expect(result).toEqual([path.join("/mock/home", ".roo"), path.join(cwd, ".roo")])
		})
	})

	describe("loadConfiguration", () => {
		it("should load global configuration only when project does not exist", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			// Mock stat calls for readFileIfExists
			mockStat.mockResolvedValueOnce({ size: 100 }).mockRejectedValueOnce(error)
			mockReadFile.mockResolvedValueOnce("global content")

			const result = await loadConfiguration("rules/rules.md", "/project/path")

			expect(result).toEqual({
				global: "global content",
				project: null,
				merged: "global content",
			})
		})

		it("should load project configuration only when global does not exist", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			// Mock stat calls for readFileIfExists
			mockStat.mockRejectedValueOnce(error).mockResolvedValueOnce({ size: 100 })
			mockReadFile.mockResolvedValueOnce("project content")

			const result = await loadConfiguration("rules/rules.md", "/project/path")

			expect(result).toEqual({
				global: null,
				project: "project content",
				merged: "project content",
			})
		})

		it("should merge global and project configurations with project overriding global", async () => {
			// Mock stat calls for readFileIfExists
			mockStat.mockResolvedValueOnce({ size: 100 }).mockResolvedValueOnce({ size: 100 })
			mockReadFile.mockResolvedValueOnce("global content").mockResolvedValueOnce("project content")

			const result = await loadConfiguration("rules/rules.md", "/project/path")

			expect(result).toEqual({
				global: "global content",
				project: "project content",
				merged: "global content\n\n# Project-specific rules (override global):\n\nproject content",
			})
		})

		it("should return empty merged content when neither exists", async () => {
			const error = new Error("ENOENT") as any
			error.code = "ENOENT"
			// Mock stat calls for readFileIfExists
			mockStat.mockRejectedValueOnce(error).mockRejectedValueOnce(error)

			const result = await loadConfiguration("rules/rules.md", "/project/path")

			expect(result).toEqual({
				global: null,
				project: null,
				merged: "",
			})
		})

		it("should propagate unexpected errors from global file read", async () => {
			const error = new Error("Permission denied") as any
			error.code = "EACCES"
			mockStat.mockRejectedValueOnce(error)

			await expect(loadConfiguration("rules/rules.md", "/project/path")).rejects.toThrow("Permission denied")
		})

		it("should propagate unexpected errors from project file read", async () => {
			const globalError = new Error("ENOENT") as any
			globalError.code = "ENOENT"
			const projectError = new Error("Permission denied") as any
			projectError.code = "EACCES"

			mockStat.mockRejectedValueOnce(globalError).mockRejectedValueOnce(projectError)

			await expect(loadConfiguration("rules/rules.md", "/project/path")).rejects.toThrow("Permission denied")
		})

		it("should use correct file paths", async () => {
			mockStat.mockResolvedValue({ size: 100 })
			mockReadFile.mockResolvedValue("content")

			await loadConfiguration("rules/rules.md", "/project/path")

			expect(mockStat).toHaveBeenCalledWith(path.join("/mock/home", ".roo", "rules/rules.md"))
			expect(mockStat).toHaveBeenCalledWith(path.join("/project/path", ".roo", "rules/rules.md"))
			expect(mockReadFile).toHaveBeenCalledWith(path.join("/mock/home", ".roo", "rules/rules.md"), "utf-8")
			expect(mockReadFile).toHaveBeenCalledWith(path.join("/project/path", ".roo", "rules/rules.md"), "utf-8")
		})

		it("should handle large config files gracefully", async () => {
			const largeSize = MAX_CONFIG_FILE_SIZE_BYTES + 1
			// Global file is too large, project file is normal
			mockStat.mockResolvedValueOnce({ size: largeSize }).mockResolvedValueOnce({ size: 100 })
			mockReadFile.mockResolvedValueOnce("project content")

			const result = await loadConfiguration("rules/rules.md", "/project/path")

			expect(result).toEqual({
				global: null,
				project: "project content",
				merged: "project content",
			})
			expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("exceeds size limit"))
		})
	})
})
