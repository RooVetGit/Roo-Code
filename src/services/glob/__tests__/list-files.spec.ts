import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import os from "os"
import * as path from "path"
import simpleGit from "simple-git"
import * as fs from "fs"

import { listFiles } from "../list-files"
import { getWorkspacePath, arePathsEqual } from "../../../utils/path"

// Mock modules
vi.mock("simple-git", () => ({
	__esModule: true,
	default: vi.fn(() => ({
		checkIgnore: vi.fn(),
	})),
}))

vi.mock("fs", () => {
	return {
		promises: {
			readdir: vi.fn(),
		},
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
	}
})

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(),
	arePathsEqual: vi.fn(),
}))

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/")
}

describe("listFiles", () => {
	const workspacePath = path.join(os.tmpdir(), "test-workspace")

	// Get references to the mocked functions
	const mockReaddir = vi.mocked(fs.promises.readdir)
	const mockSimpleGit = vi.mocked(simpleGit)
	const mockCheckIgnore = vi.fn()

	beforeEach(() => {
		// Setup mocks
		vi.mocked(getWorkspacePath).mockReturnValue(workspacePath)
		mockSimpleGit.mockReturnValue({
			checkIgnore: mockCheckIgnore,
		} as any)

		// Default: no .gitignore exists
		vi.mocked(fs.existsSync).mockImplementation((p) => false)
		vi.mocked(fs.readFileSync).mockImplementation((p) => "")

		// Clear mocks
		mockSimpleGit.mockClear()
		vi.mocked(getWorkspacePath).mockClear()
		vi.mocked(arePathsEqual).mockClear()
		mockCheckIgnore.mockClear()
		mockReaddir.mockClear()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("special directories", () => {
		it("returns root directory on Windows without listing", async (t) => {
			t.skip(process.platform !== "win32", "Skipping Windows-specific test on non-Windows environment")

			const root = "C:\\"
			vi.mocked(arePathsEqual).mockImplementation((a, b) => a === b)

			const [files, limitReached] = await listFiles(root, true, 100)
			const expected = [normalizePath(path.resolve(root))]
			expect(files).toEqual(expected)
			expect(limitReached).toBe(false)
		})

		it("returns root directory on POSIX without listing", async (t) => {
			t.skip(
				process.platform !== "linux" && process.platform !== "darwin",
				"Skipping POSIX-specific test on non-Linux environment",
			)

			const root = "/"
			vi.mocked(arePathsEqual).mockImplementation((a, b) => {
				return path.resolve(a as string) === path.resolve(b as string)
			})
			// Ensure readdir is not called for root
			mockReaddir.mockResolvedValue([])

			const [files, limitReached] = await listFiles(root, true, 100)
			const expected = [normalizePath(path.resolve(root))]
			expect(files).toEqual(expected)
			expect(limitReached).toBe(false)
			expect(mockReaddir).not.toHaveBeenCalled()
		})

		it("returns home directory without listing", async () => {
			const home = os.homedir()
			vi.mocked(arePathsEqual).mockReturnValueOnce(false) // Not root
			vi.mocked(arePathsEqual).mockReturnValueOnce(true) // Home

			const [files, limitReached] = await listFiles(home, true, 100)
			const expected = [normalizePath(path.resolve(home))]
			expect(files).toEqual(expected)
			expect(limitReached).toBe(false)
		})

		it("should ignore files in directories specified by DIRS_TO_IGNORE", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "node_modules", isDirectory: () => true },
				{ name: "regular.js", isDirectory: () => false },
			]
			mockReaddir.mockResolvedValueOnce(entries as any)
			mockCheckIgnore.mockResolvedValue([])

			const [files] = await listFiles(dirPath, true, 100)
			expect(files).toContain(normalizePath(path.join(dirPath, "regular.js")))
			expect(files.some((f) => f.includes("node_modules"))).toBe(false)
			// Verify readdir was not called on the ignored directory
			expect(mockReaddir).toHaveBeenCalledTimes(1)
		})
	})

	describe("non-special directories", () => {
		it("lists top-level files and directories non-recursively", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "file1.txt", isDirectory: () => false },
				{ name: "dir1", isDirectory: () => true },
			]
			mockReaddir.mockResolvedValue(entries as any)
			mockCheckIgnore.mockResolvedValue([])

			const [files, limitReached] = await listFiles(dirPath, false, 100)
			expect(files).toEqual([
				normalizePath(path.join(dirPath, "file1.txt")),
				normalizePath(path.join(dirPath, "dir1")),
			])
			expect(limitReached).toBe(false)
		})

		it("lists files recursively", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "file1.txt", isDirectory: () => false },
				{ name: "subdir", isDirectory: () => true },
			]
			const subEntries = [{ name: "file2.txt", isDirectory: () => false }]
			mockReaddir
				.mockResolvedValueOnce(entries as any) // Top level
				.mockResolvedValueOnce(subEntries as any) // subdir
			mockCheckIgnore.mockResolvedValue([])

			const [files, limitReached] = await listFiles(dirPath, true, 100)
			expect(files.sort()).toEqual(
				[
					normalizePath(path.join(dirPath, "file1.txt")),
					normalizePath(path.join(dirPath, "subdir", "file2.txt")),
				].sort(),
			)
			expect(limitReached).toBe(false)
		})

		it("filters git-ignored files", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "file1.txt", isDirectory: () => false },
				{ name: "ignored.txt", isDirectory: () => false },
			]
			mockReaddir.mockResolvedValue(entries as any)
			mockCheckIgnore.mockResolvedValue([path.join("test-dir", "ignored.txt")])

			// Simulate .gitignore exists and ignores ignored.txt
			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return p.toString().endsWith(".gitignore")
			})
			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				if (p.toString().endsWith(".gitignore")) {
					return "ignored.txt"
				}
				return ""
			})

			const [files, limitReached] = await listFiles(dirPath, false, 100)
			expect(files).toEqual([normalizePath(path.join(dirPath, "file1.txt"))])
			expect(limitReached).toBe(false)
		})

		it("respects the limit", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = Array(10)
				.fill(0)
				.map((_, i) => ({
					name: `file${i}.txt`,
					isDirectory: () => false,
				}))
			mockReaddir.mockResolvedValue(entries as any)
			mockCheckIgnore.mockResolvedValue([])

			const [files, limitReached] = await listFiles(dirPath, false, 5)
			expect(files.every((f) => path.isAbsolute(f))).toBe(true)
			expect(files).toHaveLength(5)
			expect(limitReached).toBe(true)
		})

		it("handles empty directories", async () => {
			const dirPath = path.join(workspacePath, "empty-dir")
			mockReaddir.mockResolvedValue([])
			mockCheckIgnore.mockResolvedValue([])
			const [files, limitReached] = await listFiles(dirPath, true, 100)
			expect(files).toEqual([])
			expect(limitReached).toBe(false)
		})

		it("handles directory with only ignored files", async () => {
			const dirPath = path.join(workspacePath, "ignored-only")
			const entries = [{ name: "ignored.txt", isDirectory: () => false }]
			mockReaddir.mockResolvedValue(entries as any)
			mockCheckIgnore.mockResolvedValue([path.join("ignored-only", "ignored.txt")])

			// Simulate .gitignore exists and ignores ignored.txt
			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return p.toString().endsWith(".gitignore")
			})
			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				if (p.toString().endsWith(".gitignore")) {
					return "ignored.txt"
				}
				return ""
			})

			const [files, limitReached] = await listFiles(dirPath, false, 100)
			expect(files).toEqual([])
			expect(limitReached).toBe(false)
		})

		it("does not traverse into git-ignored directories for performance", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "dist", isDirectory: () => true },
				{ name: "file.txt", isDirectory: () => false },
			]
			mockReaddir.mockResolvedValueOnce(entries as any)
			mockCheckIgnore.mockResolvedValue([path.join("test-dir", "dist")])

			const [files] = await listFiles(dirPath, true, 100)

			expect(files).toEqual([normalizePath(path.join(dirPath, "file.txt"))])
			// Check that readdir was only called for the top-level directory
			expect(mockReaddir).toHaveBeenCalledTimes(1)
		})

		it("should return paths with forward slashes, relative to workspace", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [{ name: "file.txt", isDirectory: () => false }]
			mockReaddir.mockResolvedValue(entries as any)
			mockCheckIgnore.mockResolvedValue([])

			const [files] = await listFiles(dirPath, false, 100)

			expect(files).toEqual([normalizePath(path.join(dirPath, "file.txt"))])
		})
	})

	describe("error handling", () => {
		it("skips unreadable directories during recursion", async () => {
			const dirPath = path.join(workspacePath, "test-dir")
			const entries = [
				{ name: "unreadable", isDirectory: () => true },
				{ name: "file.txt", isDirectory: () => false },
			]
			mockReaddir.mockResolvedValueOnce(entries as any)
			// Mock the error for the unreadable directory
			mockReaddir.mockRejectedValueOnce(new Error("Permission denied"))
			mockCheckIgnore.mockResolvedValue([])

			// Simulate .gitignore exists but does not ignore anything
			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return p.toString().endsWith(".gitignore")
			})
			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				if (p.toString().endsWith(".gitignore")) {
					return ""
				}
				return ""
			})

			const [files] = await listFiles(dirPath, true, 100)

			// Should still return the readable file (not the unreadable directory)
			expect(files.sort()).toEqual([normalizePath(path.join(dirPath, "file.txt"))].sort())
			// Should have tried to read both directories
			expect(mockReaddir).toHaveBeenCalledTimes(2)
		})
	})
})

describe("listFiles", () => {
	it("should return empty array immediately when limit is 0", async () => {
		const result = await listFiles("/test/path", true, 0)

		expect(getWorkspacePath).toHaveBeenCalledTimes(0)
		expect(result).toEqual([[], false])
	})
})
