import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as path from "path"
import { listFiles } from "../list-files"
import * as childProcess from "child_process"
import * as fs from "fs"

// Mock child_process.spawn
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

// Mock fs.promises.readdir
vi.mock("fs", async () => {
	const actual = await vi.importActual<typeof import("fs")>("fs")
	return {
		...actual,
		promises: {
			...actual.promises,
			readdir: vi.fn(),
			access: vi.fn(),
			readFile: vi.fn(),
		},
	}
})

// Import getBinPath type for mocking
import { getBinPath } from "../../../services/ripgrep"

// Mock getBinPath
vi.mock("../../../services/ripgrep", () => ({
	getBinPath: vi.fn(),
}))

// Mock vscode
vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

describe("list-files with projects under /tmp directory", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Set up getBinPath mock
		vi.mocked(getBinPath).mockResolvedValue("/path/to/rg")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should list files in a project under /tmp directory", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: { on: vi.fn() },
			stderr: { on: vi.fn() },
			on: vi.fn(),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Simulate ripgrep output for files under /tmp/project
		mockProcess.stdout.on.mockImplementation((event, callback) => {
			if (event === "data") {
				// Simulate files that should be found in /tmp/project
				const files = ["a/b/c/a.js", "src/index.ts", "package.json", "README.md"].join("\n") + "\n"
				setTimeout(() => callback(files), 10)
			}
		})

		mockProcess.on.mockImplementation((event, callback) => {
			if (event === "close") {
				setTimeout(() => callback(0), 20)
			}
		})

		// Mock directory listing for /tmp/project
		const mockReaddir = vi.mocked(fs.promises.readdir)
		mockReaddir.mockImplementation(async (dirPath) => {
			const pathStr = dirPath.toString()
			if (pathStr === path.resolve("/tmp/project")) {
				return [
					{ name: "a", isDirectory: () => true, isSymbolicLink: () => false },
					{ name: "src", isDirectory: () => true, isSymbolicLink: () => false },
					{ name: "package.json", isDirectory: () => false, isSymbolicLink: () => false },
					{ name: "README.md", isDirectory: () => false, isSymbolicLink: () => false },
				] as any
			} else if (pathStr === path.resolve("/tmp/project/a")) {
				return [{ name: "b", isDirectory: () => true, isSymbolicLink: () => false }] as any
			} else if (pathStr === path.resolve("/tmp/project/a/b")) {
				return [{ name: "c", isDirectory: () => true, isSymbolicLink: () => false }] as any
			} else if (pathStr === path.resolve("/tmp/project/a/b/c")) {
				return [{ name: "a.js", isDirectory: () => false, isSymbolicLink: () => false }] as any
			}
			return []
		})

		// Mock gitignore access (no .gitignore files)
		vi.mocked(fs.promises.access).mockRejectedValue(new Error("Not found"))

		// Call listFiles targeting /tmp/project
		const [files, didHitLimit] = await listFiles("/tmp/project", true, 100)

		// Verify ripgrep was called with correct arguments
		expect(mockSpawn).toHaveBeenCalledWith(
			"/path/to/rg",
			expect.arrayContaining([
				"--files",
				"--hidden",
				"--follow",
				"-g",
				"!**/node_modules/",
				"-g",
				"!**/__pycache__/",
				"-g",
				"!**/env/",
				"-g",
				"!**/venv/",
				"-g",
				"!**/target/dependency/",
				"-g",
				"!**/build/dependencies/",
				"-g",
				"!**/dist/",
				"-g",
				"!**/out/",
				"-g",
				"!**/bundle/",
				"-g",
				"!**/vendor/",
				"-g",
				"!**/tmp/", // This should exclude tmp directories, but not the parent /tmp
				"-g",
				"!**/temp/",
				"-g",
				"!**/deps/",
				"-g",
				"!**/pkg/",
				"-g",
				"!**/Pods/",
				"-g",
				"!**/.git/",
				"-g",
				"!**/.*/**", // Hidden directories pattern
				"/tmp/project",
			]),
		)

		// Verify files were found
		expect(files).toContain(path.resolve("/tmp/project/a/b/c/a.js"))
		expect(files).toContain(path.resolve("/tmp/project/src/index.ts"))
		expect(files).toContain(path.resolve("/tmp/project/package.json"))
		expect(files).toContain(path.resolve("/tmp/project/README.md"))

		// Verify directories were included
		expect(files).toContain(path.resolve("/tmp/project/a") + "/")
		expect(files).toContain(path.resolve("/tmp/project/a/b") + "/")
		expect(files).toContain(path.resolve("/tmp/project/a/b/c") + "/")
		expect(files).toContain(path.resolve("/tmp/project/src") + "/")

		expect(didHitLimit).toBe(false)
	})

	it("should exclude nested tmp directories within a project under /tmp", async () => {
		const mockSpawn = vi.mocked(childProcess.spawn)
		const mockProcess = {
			stdout: { on: vi.fn() },
			stderr: { on: vi.fn() },
			on: vi.fn(),
			kill: vi.fn(),
		}

		mockSpawn.mockReturnValue(mockProcess as any)

		// Simulate ripgrep output - should not include files from nested tmp directory
		mockProcess.stdout.on.mockImplementation((event, callback) => {
			if (event === "data") {
				const files =
					[
						"src/index.ts",
						"package.json",
						// Note: src/tmp/cache.js should NOT be included
					].join("\n") + "\n"
				setTimeout(() => callback(files), 10)
			}
		})

		mockProcess.on.mockImplementation((event, callback) => {
			if (event === "close") {
				setTimeout(() => callback(0), 20)
			}
		})

		// Mock directory listing
		const mockReaddir = vi.mocked(fs.promises.readdir)
		mockReaddir.mockImplementation(async (dirPath) => {
			const pathStr = dirPath.toString()
			if (pathStr === path.resolve("/tmp/myproject")) {
				return [
					{ name: "src", isDirectory: () => true, isSymbolicLink: () => false },
					{ name: "package.json", isDirectory: () => false, isSymbolicLink: () => false },
				] as any
			} else if (pathStr === path.resolve("/tmp/myproject/src")) {
				return [
					{ name: "index.ts", isDirectory: () => false, isSymbolicLink: () => false },
					{ name: "tmp", isDirectory: () => true, isSymbolicLink: () => false },
				] as any
			}
			return []
		})

		// Mock gitignore access (no .gitignore files)
		vi.mocked(fs.promises.access).mockRejectedValue(new Error("Not found"))

		// Call listFiles
		const [files, didHitLimit] = await listFiles("/tmp/myproject", true, 100)

		// Verify files from root project are included
		expect(files).toContain(path.resolve("/tmp/myproject/src/index.ts"))
		expect(files).toContain(path.resolve("/tmp/myproject/package.json"))

		// Verify nested tmp directory is NOT included
		expect(files).not.toContain(path.resolve("/tmp/myproject/src/tmp") + "/")

		// Verify the exclusion pattern was applied correctly
		const spawnCall = mockSpawn.mock.calls[0]
		const args = spawnCall[1] as string[]
		expect(args).toContain("-g")
		expect(args).toContain("!**/tmp/")
	})
})
