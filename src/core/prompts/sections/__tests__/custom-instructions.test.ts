import fs from "fs/promises"
import { PathLike } from "fs"

import { loadRuleFiles as originalLoadRuleFiles, addCustomInstructions } from "../custom-instructions"

// Mock fs/promises
jest.mock("fs/promises")

// Create mock functions
const readFileMock = jest.fn()
const statMock = jest.fn()
const readdirMock = jest.fn()
const readlinkMock = jest.fn()

// Replace fs functions with our mocks
fs.readFile = readFileMock as any
fs.stat = statMock as any
fs.readdir = readdirMock as any
fs.readlink = readlinkMock as any

const actualPath = jest.requireActual("path")

// Create a wrapped version of loadRuleFiles that normalizes paths
const loadRuleFiles = async (cwd: string): Promise<string> => {
	return await originalLoadRuleFiles(expectedPath(cwd))
}

// Mock path module
jest.mock("path", () => {
	const pathActual = jest.requireActual("path")
	return {
		...pathActual, // Use actual implementations for most functions
		join: jest.fn().mockImplementation((...args: string[]) => {
			// Filter out undefined/null/empty strings
			return args.filter((arg) => typeof arg === "string" && arg.length > 0).join(pathActual.sep)
		}),
		// resolve, parse, dirname, basename etc., will use actual implementations
	}
})

function expectedPath(forwardSlashPath: string): string {
	const path = jest.requireActual("path")
	return path.resolve(forwardSlashPath)
}

// Simplified mock for LANGUAGES, as it's imported by the module under test
const LANGUAGES = {
	en: "English",
	es: "Español",
	fr: "Français",
}

// Mock process.cwd
const originalCwd = process.cwd
beforeAll(() => {
	process.cwd = jest.fn().mockReturnValue("/fake/cwd")
})

afterAll(() => {
	process.cwd = originalCwd
})

// Helper function to reset all mocks completely - use this in tests that are sensitive to mock state
function resetAllMocks() {
	jest.clearAllMocks()
	readFileMock.mockReset()
	statMock.mockReset()
	readdirMock.mockReset()
	readlinkMock.mockReset()
}

describe("loadRuleFiles", () => {
	beforeEach(() => {
		resetAllMocks()
	})

	it("should read and trim file content", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockResolvedValue("  content with spaces  ")
		const result = await loadRuleFiles("/fake/path")
		expect(readFileMock).toHaveBeenCalled()
		expect(result).toBe("\n# Rules from .roorules:\ncontent with spaces\n")
	})

	it("should handle ENOENT error", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should handle EISDIR error", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "EISDIR" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await loadRuleFiles("/fake/path")
		}).rejects.toThrow()
	})

	it("should not combine content from multiple rule files when they exist", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			if (filePath.toString().endsWith(".clinerules")) {
				return Promise.resolve("cline rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should handle when no rule files exist", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should skip directories with same name as rule files", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			if (filePath.toString().endsWith(".clinerules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should use .roo/rules/ directory when it exists and has files", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{ name: "file1.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.roo/rules" },
			{ name: "file2.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.roo/rules" },
		] as any)

		statMock.mockImplementation(
			(_path) =>
				({
					isFile: jest.fn().mockReturnValue(true),
				}) as any,
		)

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			if (pathStr === expectedPath("/fake/path/.roo/rules/file1.txt")) {
				return Promise.resolve("content of file1")
			}
			if (pathStr === expectedPath("/fake/path/.roo/rules/file2.txt")) {
				return Promise.resolve("content of file2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/file1.txt")}:`)
		expect(result).toContain("content of file1")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/file2.txt")}:`)
		expect(result).toContain("content of file2")

		// We expect both checks because our new implementation checks the files again for validation
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/file1.txt"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/file2.txt"))
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/file1.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/file2.txt"), "utf-8")
	})

	it("should fall back to .roorules when .roo/rules/ is empty", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		// Simulate .roorules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should handle errors when reading directory", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate error reading directory
		readdirMock.mockRejectedValueOnce(new Error("Failed to read directory"))

		// Simulate .roorules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should read files from nested subdirectories in .roo/rules/", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files including subdirectories
		readdirMock.mockResolvedValueOnce([
			{
				name: "subdir",
				isFile: () => false,
				isSymbolicLink: () => false,
				isDirectory: () => true,
				parentPath: "/fake/path/.roo/rules",
			},
			{
				name: "root.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules",
			},
			{
				name: "nested1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules/subdir",
			},
			{
				name: "nested2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules/subdir/subdir2",
			},
		] as any)

		statMock.mockImplementation((path: string) => {
			if (path.endsWith("txt")) {
				return Promise.resolve({
					isFile: jest.fn().mockReturnValue(true),
					isDirectory: jest.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(false),
				isDirectory: jest.fn().mockReturnValue(true),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			if (pathStr === expectedPath("/fake/path/.roo/rules/root.txt")) {
				return Promise.resolve("root file content")
			}
			if (pathStr === expectedPath("/fake/path/.roo/rules/subdir/nested1.txt")) {
				return Promise.resolve("nested file 1 content")
			}
			if (pathStr === expectedPath("/fake/path/.roo/rules/subdir/subdir2/nested2.txt")) {
				return Promise.resolve("nested file 2 content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Check root file content
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/root.txt")}:`)
		expect(result).toContain("root file content")

		// Check nested files content
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/subdir/nested1.txt")}:`)
		expect(result).toContain("nested file 1 content")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/subdir/subdir2/nested2.txt")}:`)
		expect(result).toContain("nested file 2 content")

		// Verify correct paths were checked
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/root.txt"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/subdir/nested1.txt"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/subdir/subdir2/nested2.txt"))

		// Verify files were read with correct paths
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/root.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/subdir/nested1.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(
			expectedPath("/fake/path/.roo/rules/subdir/subdir2/nested2.txt"),
			"utf-8",
		)
	})
})

describe("addCustomInstructions", () => {
	beforeEach(() => {
		resetAllMocks()
	})

	it("should combine all instruction types when provided", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockResolvedValue("mode specific rules")

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "es" },
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain("Español") // Check for language name
		expect(result).toContain("(es)") // Check for language code in parentheses
		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).toContain("Rules from .roorules-test-mode:\nmode specific rules")
	})

	it("should return empty string when no instructions provided", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions("", "", "/fake/path", "", {})
		expect(result).toBe("")
	})

	it("should handle missing mode-specific rules file", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:")
		expect(result).toContain("Mode-specific Instructions:")
		expect(result).not.toContain("Rules from .clinerules-test-mode")
	})

	it("should handle unknown language codes properly", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "xyz" }, // Unknown language code
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain('"xyz" (xyz) language') // For unknown codes, the code is used as the name too
		expect(result).toContain("Global Instructions:\nglobal instructions")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await addCustomInstructions("", "", "/fake/path", "test-mode")
		}).rejects.toThrow()
	})

	it("should skip mode-specific rule files that are directories", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".clinerules-test-mode")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).not.toContain("Rules from .clinerules-test-mode")
	})

	it("should use .roo/rules-test-mode/ directory when it exists and has files", async () => {
		// Simulate .roo/rules-test-mode directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{
				name: "rule1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.roo/rules-test-mode",
			},
			{
				name: "rule2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.roo/rules-test-mode",
			},
		] as any)

		statMock.mockImplementation(
			(_path) =>
				({
					isFile: jest.fn().mockReturnValue(true),
				}) as any,
		)

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			if (pathStr === expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt")) {
				return Promise.resolve("mode specific rule 1")
			}
			if (pathStr === expectedPath("/fake/path/.roo/rules-test-mode/rule2.txt")) {
				return Promise.resolve("mode specific rule 2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "es" },
		)

		expect(result).toContain(expectedPath("/fake/path/.roo/rules-test-mode"))
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt")}:`)
		expect(result).toContain("mode specific rule 1")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules-test-mode/rule2.txt")}:`)
		expect(result).toContain("mode specific rule 2")

		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules-test-mode"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt"))
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules-test-mode/rule2.txt"))
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules-test-mode/rule2.txt"), "utf-8")
	})

	it("should fall back to .roorules-test-mode when .roo/rules-test-mode/ does not exist", async () => {
		// Simulate .roo/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate .roorules-test-mode exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".roorules-test-mode")) {
				return Promise.resolve("mode specific rules from file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .roorules-test-mode:\nmode specific rules from file")
	})

	it("should fall back to .clinerules-test-mode when .roo/rules-test-mode/ and .roorules-test-mode do not exist", async () => {
		// Simulate .roo/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate file reading
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".roorules-test-mode")) {
				return Promise.reject({ code: "ENOENT" })
			}
			if (filePath.toString().includes(".clinerules-test-mode")) {
				return Promise.resolve("mode specific rules from cline file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .clinerules-test-mode:\nmode specific rules from cline file")
	})

	it("should correctly format content from directories when using .roo/rules-test-mode/", async () => {
		// Need to reset mockImplementation first to avoid interference from previous tests
		statMock.mockReset()
		readFileMock.mockReset()

		// Simulate .roo/rules-test-mode directory exists
		statMock.mockImplementationOnce(() =>
			Promise.resolve({
				isDirectory: jest.fn().mockReturnValue(true),
			} as any),
		)

		// Simulate directory has files
		readdirMock.mockResolvedValueOnce([
			{ name: "rule1.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules-test-mode" },
		] as any)
		readFileMock.mockReset()

		// Set up stat mock for checking files
		let statCallCount = 0
		statMock.mockImplementation((filePath) => {
			statCallCount++
			if (filePath === expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt")) {
				return Promise.resolve({
					isFile: jest.fn().mockReturnValue(true),
					isDirectory: jest.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(false),
				isDirectory: jest.fn().mockReturnValue(false),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			if (pathStr === expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt")) {
				return Promise.resolve("mode specific rule content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain(expectedPath("/fake/path/.roo/rules-test-mode"))
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules-test-mode/rule1.txt")}:`)
		expect(result).toContain("mode specific rule content")

		expect(statCallCount).toBeGreaterThan(0)
	})
})

// Test directory existence checks through loadRuleFiles
describe("Directory existence checks", () => {
	beforeEach(() => {
		resetAllMocks()
	})

	it("should detect when directory exists", async () => {
		// Mock the stats to indicate the directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory to test that stats is called
		readdirMock.mockResolvedValueOnce([])

		// For loadRuleFiles to return something for testing
		readFileMock.mockResolvedValueOnce("fallback content")

		await loadRuleFiles("/fake/path")

		// Verify stat was called to check directory existence
		expect(statMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules"))
	})

	it("should handle when directory does not exist", async () => {
		// Mock the stats to indicate the directory doesn't exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Mock file read to verify fallback
		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")

		// Verify it fell back to reading rule files directly
		expect(result).toBe("\n# Rules from .roorules:\nfallback content\n")
	})
})

// Indirectly test readTextFilesFromDirectory and formatDirectoryContent through loadRuleFiles
describe("Rules directory reading", () => {
	beforeEach(() => {
		resetAllMocks()
	})

	it("should follow symbolic links in the rules directory", async () => {
		// Set up stat mock with a consistent implementation
		statMock.mockImplementation((path: string) => {
			// For initial directory check and directories
			if (
				path === expectedPath("/fake/path/.roo/rules") ||
				path === expectedPath("/fake/path/.roo/symlink-target-dir") ||
				path === expectedPath("/fake/path/.roo/rules/symlink-target-dir")
			) {
				return Promise.resolve({
					isDirectory: () => true,
					isFile: () => false,
				})
			}

			// For regular files
			if (
				path === expectedPath("/fake/path/.roo/rules/regular.txt") ||
				path === expectedPath("/fake/path/.roo/symlink-target.txt") ||
				path === expectedPath("/fake/path/.roo/nested-symlink-target.txt") ||
				path === expectedPath("/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt")
			) {
				return Promise.resolve({
					isDirectory: () => false,
					isFile: () => true,
				})
			}

			// For symlinks
			if (
				path === expectedPath("/fake/path/.roo/rules/link.txt") ||
				path === expectedPath("/fake/path/.roo/rules/link_dir") ||
				path === expectedPath("/fake/path/.roo/rules/nested_link.txt") ||
				path === expectedPath("/fake/path/.roo/nested-symlink")
			) {
				return Promise.resolve({
					isDirectory: () => false,
					isFile: () => false,
					isSymbolicLink: () => true,
				})
			}

			// Default case - return file
			return Promise.resolve({
				isDirectory: () => false,
				isFile: () => true,
			})
		})

		// Set up readdir mock with consistent file list
		readdirMock.mockImplementation((path: string) => {
			if (path === expectedPath("/fake/path/.roo/rules")) {
				return Promise.resolve([
					{
						name: "regular.txt",
						isFile: () => true,
						isSymbolicLink: () => false,
						parentPath: "/fake/path/.roo/rules",
					},
					{
						name: "link.txt",
						isFile: () => false,
						isSymbolicLink: () => true,
						parentPath: "/fake/path/.roo/rules",
					},
					{
						name: "link_dir",
						isFile: () => false,
						isSymbolicLink: () => true,
						parentPath: "/fake/path/.roo/rules",
					},
					{
						name: "nested_link.txt",
						isFile: () => false,
						isSymbolicLink: () => true,
						parentPath: "/fake/path/.roo/rules",
					},
				])
			}

			if (
				path === expectedPath("/fake/path/.roo/symlink-target-dir") ||
				path === expectedPath("/fake/path/.roo/rules/symlink-target-dir")
			) {
				return Promise.resolve([
					{
						name: "subdir_link.txt",
						isFile: () => true,
						isSymbolicLink: () => false,
						parentPath: "/fake/path/.roo/rules/symlink-target-dir",
					},
				])
			}

			return Promise.resolve([])
		})

		// Set up readlink mock with a consistent implementation
		readlinkMock.mockImplementation((path: string) => {
			const pathMap = {
				[expectedPath("/fake/path/.roo/rules/link.txt")]: "../symlink-target.txt",
				[expectedPath("/fake/path/.roo/rules/link_dir")]: "../symlink-target-dir",
				[expectedPath("/fake/path/.roo/rules/nested_link.txt")]: "../nested-symlink",
				[expectedPath("/fake/path/.roo/nested-symlink")]: "nested-symlink-target.txt",
			}

			if (path in pathMap) {
				return Promise.resolve(pathMap[path])
			}

			return Promise.reject(new Error(`Unexpected readlink call for path: ${path}`))
		})

		// Set up readFile mock with a consistent implementation
		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			const fileContents = {
				[expectedPath("/fake/path/.roo/rules/regular.txt")]: "regular file content",
				[expectedPath("/fake/path/.roo/symlink-target.txt")]: "symlink target content",
				[expectedPath("/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt")]:
					"regular file content under symlink target dir",
				[expectedPath("/fake/path/.roo/nested-symlink-target.txt")]: "nested symlink target content",
			}

			if (pathStr in fileContents) {
				return Promise.resolve(fileContents[pathStr])
			}

			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Verify both regular file and symlink target content are included
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/regular.txt")}:`)
		expect(result).toContain("regular file content")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/symlink-target.txt")}:`)
		expect(result).toContain("symlink target content")
		expect(result).toContain(
			`# Rules from ${expectedPath("/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt")}:`,
		)
		expect(result).toContain("regular file content under symlink target dir")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/nested-symlink-target.txt")}:`)
		expect(result).toContain("nested symlink target content")

		// Verify readlink was called with the symlink path
		expect(readlinkMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/link.txt"))
		expect(readlinkMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/link_dir"))

		// Verify both files were read
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/rules/regular.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/symlink-target.txt"), "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(
			expectedPath("/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt"),
			"utf-8",
		)
		expect(readFileMock).toHaveBeenCalledWith(expectedPath("/fake/path/.roo/nested-symlink-target.txt"), "utf-8")
	})

	it("should correctly format multiple files from directory", async () => {
		// Set up directory check first - use mockImplementation instead of mockResolvedValueOnce
		// to handle multiple calls to the same function with the same arguments
		statMock.mockImplementation((path) => {
			// For directory check
			if (path === expectedPath("/fake/path/.roo/rules")) {
				return Promise.resolve({
					isDirectory: () => true,
					isFile: () => false,
				})
			}

			// For file checks
			if (
				[
					expectedPath("/fake/path/.roo/rules/file1.txt"),
					expectedPath("/fake/path/.roo/rules/file2.txt"),
					expectedPath("/fake/path/.roo/rules/file3.txt"),
				].includes(path)
			) {
				return Promise.resolve({
					isDirectory: () => false,
					isFile: () => true,
				})
			}

			// Default case for unknown paths
			return Promise.reject({ code: "ENOENT" })
		})

		// Simulate listing files
		readdirMock.mockResolvedValue([
			{ name: "file1.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
			{ name: "file2.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
			{ name: "file3.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
		] as any)

		// Set up file content reading with a consistent implementation
		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			const fileContents = {
				[expectedPath("/fake/path/.roo/rules/file1.txt")]: "content of file1",
				[expectedPath("/fake/path/.roo/rules/file2.txt")]: "content of file2",
				[expectedPath("/fake/path/.roo/rules/file3.txt")]: "content of file3",
			}

			if (pathStr in fileContents) {
				return Promise.resolve(fileContents[pathStr])
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/file1.txt")}:`)
		expect(result).toContain("content of file1")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/file2.txt")}:`)
		expect(result).toContain("content of file2")
		expect(result).toContain(`# Rules from ${expectedPath("/fake/path/.roo/rules/file3.txt")}:`)
		expect(result).toContain("content of file3")
	})

	it("should handle empty file list gracefully", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nfallback content\n")
	})
})
