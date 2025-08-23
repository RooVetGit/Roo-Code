import { describe, it, expect, vi, beforeEach } from "vitest"
import { searchWorkspaceFiles } from "../file-search"

// Mock child_process module
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

// Mock readline module
vi.mock("readline", () => ({
	createInterface: vi.fn(),
}))

// Mock the getBinPath function
vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn().mockResolvedValue("/mock/path/to/rg"),
}))

// Mock vscode
vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

// Mock fs module
vi.mock("fs", () => ({
	existsSync: vi.fn(),
	lstatSync: vi.fn(),
}))

describe("searchWorkspaceFiles", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should find files with spaces when searching with partial name without spaces", async () => {
		const childProcess = await import("child_process")
		const readline = await import("readline")
		const fs = await import("fs")

		// Mock ripgrep output with files containing spaces
		const mockFiles = [
			"/workspace/test file with spaces.md",
			"/workspace/another test file.ts",
			"/workspace/normalfile.js",
			"/workspace/test-no-spaces.md",
		]

		// Mock child_process.spawn
		const mockStdout = {
			on: vi.fn(),
			pipe: vi.fn(),
		}
		const mockStderr = {
			on: vi.fn((event, callback) => {
				if (event === "data") {
					// No error output
				}
			}),
		}
		const mockProcess = {
			stdout: mockStdout,
			stderr: mockStderr,
			on: vi.fn((event, callback) => {
				if (event === "error") {
					// No error
				}
			}),
			kill: vi.fn(),
		}

		vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

		// Mock readline interface
		const mockReadline = {
			on: vi.fn((event, callback) => {
				if (event === "line") {
					// Simulate ripgrep outputting file paths
					mockFiles.forEach((file) => callback(file))
				}
				if (event === "close") {
					// Simulate process closing
					setTimeout(() => callback(), 0)
				}
			}),
			close: vi.fn(),
		}

		vi.mocked(readline.createInterface).mockReturnValue(mockReadline as any)

		// Mock fs functions
		vi.mocked(fs.existsSync).mockReturnValue(true)
		vi.mocked(fs.lstatSync).mockReturnValue({
			isDirectory: () => false,
		} as any)

		// Test searching for "testfile" (without spaces) should find "test file with spaces.md"
		const results = await searchWorkspaceFiles("testfile", "/workspace", 20)

		// The results should include files with spaces that match the query
		const fileNames = results.map((r) => r.path)

		// "test file with spaces.md" should be found when searching for "testfile"
		expect(fileNames).toContain("test file with spaces.md")
		expect(fileNames).toContain("another test file.ts")
	})

	it("should find files when searching with exact name including spaces", async () => {
		const childProcess = await import("child_process")
		const readline = await import("readline")
		const fs = await import("fs")

		// Mock ripgrep output
		const mockFiles = [
			"/workspace/test file with spaces.md",
			"/workspace/another test file.ts",
			"/workspace/normalfile.js",
		]

		const mockStdout = {
			on: vi.fn(),
			pipe: vi.fn(),
		}
		const mockStderr = {
			on: vi.fn(),
		}
		const mockProcess = {
			stdout: mockStdout,
			stderr: mockStderr,
			on: vi.fn(),
			kill: vi.fn(),
		}

		vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

		const mockReadline = {
			on: vi.fn((event, callback) => {
				if (event === "line") {
					mockFiles.forEach((file) => callback(file))
				}
				if (event === "close") {
					setTimeout(() => callback(), 0)
				}
			}),
			close: vi.fn(),
		}

		vi.mocked(readline.createInterface).mockReturnValue(mockReadline as any)

		// Mock fs functions
		vi.mocked(fs.existsSync).mockReturnValue(true)
		vi.mocked(fs.lstatSync).mockReturnValue({
			isDirectory: () => false,
		} as any)

		// Test searching for "test file" (with space) should find matching files
		const results = await searchWorkspaceFiles("test file", "/workspace", 20)

		const fileNames = results.map((r) => r.path)
		expect(fileNames).toContain("test file with spaces.md")
		expect(fileNames).toContain("another test file.ts")
	})

	it("should find files when searching with partial words", async () => {
		const childProcess = await import("child_process")
		const readline = await import("readline")
		const fs = await import("fs")

		// Mock ripgrep output
		const mockFiles = [
			"/workspace/test file with spaces.md",
			"/workspace/documentation file.md",
			"/workspace/config.json",
		]

		const mockStdout = {
			on: vi.fn(),
			pipe: vi.fn(),
		}
		const mockStderr = {
			on: vi.fn(),
		}
		const mockProcess = {
			stdout: mockStdout,
			stderr: mockStderr,
			on: vi.fn(),
			kill: vi.fn(),
		}

		vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

		const mockReadline = {
			on: vi.fn((event, callback) => {
				if (event === "line") {
					mockFiles.forEach((file) => callback(file))
				}
				if (event === "close") {
					setTimeout(() => callback(), 0)
				}
			}),
			close: vi.fn(),
		}

		vi.mocked(readline.createInterface).mockReturnValue(mockReadline as any)

		// Mock fs functions
		vi.mocked(fs.existsSync).mockReturnValue(true)
		vi.mocked(fs.lstatSync).mockReturnValue({
			isDirectory: () => false,
		} as any)

		// Test searching for just "test" should find files with "test" in the name
		const results = await searchWorkspaceFiles("test", "/workspace", 20)

		const fileNames = results.map((r) => r.path)
		expect(fileNames).toContain("test file with spaces.md")

		// Should not contain files without "test" in the name
		expect(fileNames).not.toContain("config.json")
	})

	it("should return all items when query is empty", async () => {
		const childProcess = await import("child_process")
		const readline = await import("readline")
		const fs = await import("fs")

		const mockFiles = ["/workspace/file1.ts", "/workspace/file2.js", "/workspace/file3.md"]

		const mockStdout = {
			on: vi.fn(),
			pipe: vi.fn(),
		}
		const mockStderr = {
			on: vi.fn(),
		}
		const mockProcess = {
			stdout: mockStdout,
			stderr: mockStderr,
			on: vi.fn(),
			kill: vi.fn(),
		}

		vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

		const mockReadline = {
			on: vi.fn((event, callback) => {
				if (event === "line") {
					mockFiles.forEach((file) => callback(file))
				}
				if (event === "close") {
					setTimeout(() => callback(), 0)
				}
			}),
			close: vi.fn(),
		}

		vi.mocked(readline.createInterface).mockReturnValue(mockReadline as any)

		// Mock fs functions
		vi.mocked(fs.existsSync).mockReturnValue(true)
		vi.mocked(fs.lstatSync).mockReturnValue({
			isDirectory: () => false,
		} as any)

		// Test with empty query
		const results = await searchWorkspaceFiles("", "/workspace", 2)

		// Should return limited number of results
		expect(results.length).toBeLessThanOrEqual(2)
	})
})
