import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as childProcess from "child_process"
import * as path from "path"
import * as vscode from "vscode"
import * as readline from "readline"
import { executeRipgrepForFiles } from "../file-search"
import { getBinPath } from "../../ripgrep"

vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn(),
}))

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

vi.mock("readline", () => ({
	createInterface: vi.fn(),
}))

describe("file-search", () => {
	const mockRgPath = "/mock/path/to/rg"
	const mockWorkspacePath = "/mock/workspace"

	beforeEach(() => {
		vi.mocked(getBinPath).mockResolvedValue(mockRgPath)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("executeRipgrepForFiles", () => {
		it("should include --no-ignore-vcs flag to bypass .gitignore", async () => {
			// Create mock readline interface
			const mockRl = {
				on: vi.fn(),
				close: vi.fn(),
			}

			// Set up readline mock to emit lines
			mockRl.on.mockImplementation((event, callback) => {
				if (event === "line") {
					// Simulate file output
					callback("/mock/workspace/file1.txt")
					callback("/mock/workspace/ignored-by-git.txt")
				} else if (event === "close") {
					// Simulate readline close
					setTimeout(() => callback(), 0)
				}
				return mockRl
			})

			vi.mocked(readline.createInterface).mockReturnValue(mockRl as any)

			// Create a mock ripgrep process
			const mockStderr = {
				on: vi.fn(),
			}

			const mockProcess = {
				stdout: {},
				stderr: mockStderr,
				on: vi.fn((event, callback) => {
					if (event === "close") {
						// Delay to ensure readline processes all lines
						setTimeout(() => callback(0), 10)
					}
					return mockProcess
				}),
				kill: vi.fn(),
			}

			vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

			// Call the function
			const results = await executeRipgrepForFiles(mockWorkspacePath)

			// Verify ripgrep was called with correct arguments
			expect(childProcess.spawn).toHaveBeenCalledWith(mockRgPath, [
				"--files",
				"--follow",
				"--hidden",
				"--no-ignore-vcs", // This is the key flag we added
				"-g",
				"!**/node_modules/**",
				"-g",
				"!**/.git/**",
				"-g",
				"!**/out/**",
				"-g",
				"!**/dist/**",
				mockWorkspacePath,
			])

			// Verify results include files that might be in .gitignore
			expect(results).toContainEqual({
				path: "file1.txt",
				type: "file",
				label: "file1.txt",
			})
			expect(results).toContainEqual({
				path: "ignored-by-git.txt",
				type: "file",
				label: "ignored-by-git.txt",
			})
		})

		it("should handle ripgrep errors gracefully", async () => {
			// Create mock readline interface
			const mockRl = {
				on: vi.fn(),
				close: vi.fn(),
			}

			vi.mocked(readline.createInterface).mockReturnValue(mockRl as any)

			const mockProcess = {
				stdout: {},
				stderr: {
					on: vi.fn((event, callback) => {
						if (event === "data") {
							callback(Buffer.from("Error: something went wrong"))
						}
					}),
				},
				on: vi.fn((event, callback) => {
					if (event === "error") {
						callback(new Error("ripgrep failed"))
					}
					return mockProcess
				}),
				kill: vi.fn(),
			}

			vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

			// Should reject with error
			await expect(executeRipgrepForFiles(mockWorkspacePath)).rejects.toThrow(
				"ripgrep process error: ripgrep failed",
			)
		})

		it("should respect the file limit", async () => {
			// Create mock readline interface
			const mockRl = {
				on: vi.fn(),
				close: vi.fn(),
			}

			let lineCount = 0
			mockRl.on.mockImplementation((event, callback) => {
				if (event === "line") {
					// Simulate many files
					for (let i = 1; i <= 10; i++) {
						if (lineCount < 5) {
							// Respect the limit
							callback(`/mock/workspace/file${i}.txt`)
							lineCount++
						}
					}
				} else if (event === "close") {
					setTimeout(() => callback(), 0)
				}
				return mockRl
			})

			vi.mocked(readline.createInterface).mockReturnValue(mockRl as any)

			const mockStderr = {
				on: vi.fn(),
			}

			const mockProcess = {
				stdout: {},
				stderr: mockStderr,
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(() => callback(0), 10)
					}
					return mockProcess
				}),
				kill: vi.fn(),
			}

			vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any)

			// Call with a limit of 5
			const results = await executeRipgrepForFiles(mockWorkspacePath, 5)

			// Should only return 5 files
			expect(results.filter((r) => r.type === "file")).toHaveLength(5)
		})
	})
})
