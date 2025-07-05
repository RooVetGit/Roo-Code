import { vi, describe, it, expect, beforeEach } from "vitest"
import * as path from "path"
import * as fs from "fs"
import * as childProcess from "child_process"
import { listFiles } from "../list-files"

// Mock ripgrep to avoid filesystem dependencies
vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn().mockResolvedValue("/mock/path/to/rg"),
}))

// Mock vscode
vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

// Mock filesystem operations
vi.mock("fs", () => ({
	promises: {
		access: vi.fn().mockRejectedValue(new Error("Not found")),
		readFile: vi.fn().mockResolvedValue(""),
		readdir: vi.fn().mockResolvedValue([]),
	},
}))

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

vi.mock("../../path", () => ({
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

vi.mock("../list-files", async () => {
	const actual = await vi.importActual("../list-files")
	return {
		...actual,
		handleSpecialDirectories: vi.fn(),
	}
})

describe("listFiles", () => {
	it("should return empty array immediately when limit is 0", async () => {
		const result = await listFiles("/test/path", true, 0)

		expect(result).toEqual([[], false])
	})

	describe("Whitelist functionality", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should list files in .roo/temp even when .roo is gitignored", async () => {
			const mockSpawn = vi.mocked(childProcess.spawn)
			const mockFs = vi.mocked(fs.promises)

			// Mock .gitignore file with .roo
			mockFs.access.mockImplementation((path) => {
				if ((path as string).endsWith(".gitignore")) {
					return Promise.resolve()
				}
				return Promise.reject(new Error("Not found"))
			})
			mockFs.readFile.mockImplementation((path) => {
				if ((path as string).endsWith(".gitignore")) {
					return Promise.resolve(".roo")
				}
				return Promise.resolve("")
			})

			// Mock directory structure
			mockFs.readdir.mockImplementation((dirPath) => {
				const resolvedPath = path.resolve(dirPath as string)
				if (resolvedPath === path.resolve(".")) {
					return Promise.resolve([
						{ name: ".roo", isDirectory: () => true, isSymbolicLink: () => false },
						{ name: "src", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo")) {
					return Promise.resolve([
						{ name: "temp", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo/temp")) {
					return Promise.resolve([
						{ name: "test.txt", isDirectory: () => false, isSymbolicLink: () => false },
					] as any)
				}
				return Promise.resolve([])
			})

			// Mock ripgrep process
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							setTimeout(() => callback(".roo/temp/test.txt\n"), 10)
						}
					}),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 20)
					}
				}),
				kill: vi.fn(),
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const [files] = await listFiles(".", true, 100)

			// Should include the whitelisted file - check with normalized paths
			const hasRooTempFile = files.some((file) => file.replace(/\\/g, "/").includes(".roo/temp/test.txt"))
			expect(hasRooTempFile).toBe(true)

			// The directories should be included in the results - check with normalized paths
			const hasRooDir = files.some((file) => file.replace(/\\/g, "/").includes(".roo/"))
			const hasRooTempDir = files.some((file) => file.replace(/\\/g, "/").includes(".roo/temp/"))
			expect(hasRooDir).toBe(true)
			expect(hasRooTempDir).toBe(true)
		})

		it("should handle nested hidden directories correctly", async () => {
			const mockSpawn = vi.mocked(childProcess.spawn)
			const mockFs = vi.mocked(fs.promises)

			// Mock directory structure with nested hidden directories
			mockFs.readdir.mockImplementation((dirPath) => {
				const resolvedPath = path.resolve(dirPath as string)
				if (resolvedPath === path.resolve(".roo/temp")) {
					return Promise.resolve([
						{ name: "subdir", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo/temp/subdir")) {
					return Promise.resolve([
						{ name: ".hidden", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo/temp/subdir/.hidden")) {
					return Promise.resolve([
						{ name: "file.txt", isDirectory: () => false, isSymbolicLink: () => false },
					] as any)
				}
				return Promise.resolve([])
			})

			// Mock ripgrep process
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							setTimeout(() => callback(".roo/temp/subdir/.hidden/file.txt\n"), 10)
						}
					}),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 20)
					}
				}),
				kill: vi.fn(),
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const [files] = await listFiles(".roo/temp", true, 100)

			// Should include files in nested hidden directories under whitelisted paths
			expect(files).toContain(".roo/temp/subdir/.hidden/file.txt")
		})

		it("should not whitelist other hidden directories", async () => {
			const mockSpawn = vi.mocked(childProcess.spawn)
			const mockFs = vi.mocked(fs.promises)

			// Mock directory structure
			mockFs.readdir.mockImplementation((dirPath) => {
				const resolvedPath = path.resolve(dirPath as string)
				if (resolvedPath === path.resolve(".")) {
					return Promise.resolve([
						{ name: ".other-hidden", isDirectory: () => true, isSymbolicLink: () => false },
						{ name: ".roo", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				return Promise.resolve([])
			})

			// Mock ripgrep process - should not return .other-hidden files
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							// Only return non-hidden files
							setTimeout(() => callback(""), 10)
						}
					}),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 20)
					}
				}),
				kill: vi.fn(),
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const [files] = await listFiles(".", true, 100)

			// Should not include files from other hidden directories
			expect(files).not.toContain(".other-hidden/")
			expect(files).not.toContain(".other-hidden/file.txt")
		})

		it("should respect whitelist even when parent directory is gitignored", async () => {
			const mockSpawn = vi.mocked(childProcess.spawn)
			const mockFs = vi.mocked(fs.promises)

			// Mock .gitignore with parent directory
			mockFs.access.mockImplementation((path) => {
				if ((path as string).endsWith(".gitignore")) {
					return Promise.resolve()
				}
				return Promise.reject(new Error("Not found"))
			})
			mockFs.readFile.mockImplementation((path) => {
				if ((path as string).endsWith(".gitignore")) {
					return Promise.resolve(".roo/")
				}
				return Promise.resolve("")
			})

			// Mock directory structure
			mockFs.readdir.mockImplementation((dirPath) => {
				const resolvedPath = path.resolve(dirPath as string)
				if (resolvedPath === path.resolve(".")) {
					return Promise.resolve([
						{ name: ".roo", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo")) {
					return Promise.resolve([
						{ name: "temp", isDirectory: () => true, isSymbolicLink: () => false },
						{ name: "other", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				return Promise.resolve([])
			})

			// Mock ripgrep process
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							setTimeout(() => callback(".roo/temp/workflow.json\n"), 10)
						}
					}),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 20)
					}
				}),
				kill: vi.fn(),
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const [files] = await listFiles(".", true, 100)

			// Should include whitelisted paths even when parent is gitignored
			expect(files).toContain(".roo/temp/workflow.json")
		})

		it("should handle case-sensitive paths correctly on different platforms", async () => {
			const mockSpawn = vi.mocked(childProcess.spawn)
			const mockFs = vi.mocked(fs.promises)

			// Mock directory structure with different case variations
			mockFs.readdir.mockImplementation((dirPath) => {
				const resolvedPath = path.resolve(dirPath as string)
				if (resolvedPath === path.resolve(".")) {
					return Promise.resolve([
						{ name: ".roo", isDirectory: () => true, isSymbolicLink: () => false },
						{ name: ".Roo", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".roo")) {
					return Promise.resolve([
						{ name: "temp", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				if (resolvedPath === path.resolve(".Roo")) {
					return Promise.resolve([
						{ name: "Temp", isDirectory: () => true, isSymbolicLink: () => false },
					] as any)
				}
				return Promise.resolve([])
			})

			// Mock ripgrep process - should only return files from whitelisted .roo/temp
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							setTimeout(() => {
								// Only return files from the whitelisted .roo/temp directory
								callback(".roo/temp/file1.txt\n")
							}, 10)
						}
					}),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 20)
					}
				}),
				kill: vi.fn(),
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const [files] = await listFiles(".", true, 100)

			// On case-sensitive systems, .roo and .Roo are different directories
			// The whitelist is for ".roo/temp" specifically
			expect(files).toContain(".roo/temp/file1.txt")

			// .Roo/Temp should not be whitelisted as it's a different path on case-sensitive systems
			const hasUpperCaseRoo = files.some((file) => file.includes(".Roo/"))
			expect(hasUpperCaseRoo).toBe(false)
		})
	})
})
