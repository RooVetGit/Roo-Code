import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock getBinPath first - this needs to be hoisted
vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn().mockResolvedValue("/usr/bin/rg"),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	env: {
		appRoot: "/mock/vscode/app",
	},
}))

// Mock child_process
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

// Mock readline
vi.mock("readline", () => ({
	createInterface: vi.fn(),
}))

// Import after mocks are set up
import * as vscode from "vscode"
import * as childProcess from "child_process"
import * as readline from "readline"
import { executeRipgrepForFiles, searchWorkspaceFiles } from "../file-search"

describe("file-search", () => {
	const mockSpawn = vi.mocked(childProcess.spawn)
	const mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
	const mockCreateInterface = vi.mocked(readline.createInterface)

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default mocks for each test
		const mockProcess = {
			stdout: {},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn(),
			kill: vi.fn(),
		}

		const mockReadlineInterface = {
			on: vi.fn((event, callback) => {
				if (event === "line") {
					// Simulate some file output
					setTimeout(() => {
						callback("/test/workspace/src/file1.ts")
						callback("/test/workspace/src/file2.ts")
					}, 10)
				} else if (event === "close") {
					setTimeout(() => callback(), 20)
				}
			}),
			close: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)
		mockCreateInterface.mockReturnValue(mockReadlineInterface as any)
	})

	describe("executeRipgrepForFiles", () => {
		it("should include --no-ignore-vcs flag when respectIgnoreFiles is false", async () => {
			const workspacePath = "/test/workspace"

			// Test with respectIgnoreFiles = false
			await executeRipgrepForFiles(workspacePath, 5000, false)

			// Verify that --no-ignore-vcs was included in the args
			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", expect.arrayContaining(["--no-ignore-vcs"]))
		})

		it("should not include --no-ignore-vcs flag when respectIgnoreFiles is true", async () => {
			const workspacePath = "/test/workspace"

			// Test with respectIgnoreFiles = true (default)
			await executeRipgrepForFiles(workspacePath, 5000, true)

			// Verify that --no-ignore-vcs was NOT included in the args
			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", expect.not.arrayContaining(["--no-ignore-vcs"]))
		})
	})

	describe("searchWorkspaceFiles", () => {
		it("should respect VSCode search.useIgnoreFiles setting when true", async () => {
			// Mock VSCode configuration to return useIgnoreFiles = true
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockReturnValue(true),
			} as any)

			await searchWorkspaceFiles("test", "/test/workspace", 20)

			// Verify VSCode configuration was checked
			expect(mockGetConfiguration).toHaveBeenCalledWith("search")

			// Verify that --no-ignore-vcs was NOT included (respecting .gitignore)
			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", expect.not.arrayContaining(["--no-ignore-vcs"]))
		})

		it("should respect VSCode search.useIgnoreFiles setting when false", async () => {
			// Mock VSCode configuration to return useIgnoreFiles = false
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockReturnValue(false),
			} as any)

			await searchWorkspaceFiles("test", "/test/workspace", 20)

			// Verify VSCode configuration was checked
			expect(mockGetConfiguration).toHaveBeenCalledWith("search")

			// Verify that --no-ignore-vcs was included (ignoring .gitignore)
			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", expect.arrayContaining(["--no-ignore-vcs"]))
		})

		it("should default to respecting ignore files when VSCode setting is not available", async () => {
			// Mock VSCode configuration to return undefined (use default)
			mockGetConfiguration.mockReturnValue({
				get: vi.fn().mockReturnValue(undefined),
			} as any)

			await searchWorkspaceFiles("test", "/test/workspace", 20)

			// Verify that the default behavior (respecting .gitignore) is used
			expect(mockSpawn).toHaveBeenCalledWith("/usr/bin/rg", expect.not.arrayContaining(["--no-ignore-vcs"]))
		})
	})
})
