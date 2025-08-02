import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { HierarchicalMemoryManager } from "../HierarchicalMemoryManager"
import { fileExistsAtPath } from "../../../utils/fs"

// Mock fs/promises
vi.mock("fs/promises")
// Mock fileExistsAtPath
vi.mock("../../../utils/fs")

describe("HierarchicalMemoryManager", () => {
	let manager: HierarchicalMemoryManager

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with enabled state and file names", () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md", "Roorules.md"])
			expect(manager).toBeDefined()
		})

		it("should initialize with disabled state", () => {
			manager = new HierarchicalMemoryManager(false, [])
			expect(manager).toBeDefined()
		})
	})

	describe("loadFor", () => {
		it("should return empty array when disabled", async () => {
			manager = new HierarchicalMemoryManager(false, ["CLAUDE.md"])
			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toEqual([])
		})

		it("should return empty array when no file names configured", async () => {
			manager = new HierarchicalMemoryManager(true, [])
			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toEqual([])
		})

		it("should load memory files from parent directories", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				return (
					filePath === path.join("/project/src", "CLAUDE.md") ||
					filePath === path.join("/project", "CLAUDE.md")
				)
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === path.join("/project/src", "CLAUDE.md")) {
					return "# Source Memory\nThis is source directory memory."
				}
				if (filePath === path.join("/project", "CLAUDE.md")) {
					return "# Project Memory\nThis is project root memory."
				}
				throw new Error("File not found")
			})

			const result = await manager.loadFor("/project/src/components/file.ts", "/project")

			expect(result).toHaveLength(2)
			// Results are reversed (root → leaf), so project memory comes first
			expect(result[0]).toMatchObject({
				role: "user",
				content: expect.stringContaining("Memory from /project/CLAUDE.md"),
				isHierarchicalMemory: true,
			})
			expect(result[1]).toMatchObject({
				role: "user",
				content: expect.stringContaining("Memory from /project/src/CLAUDE.md"),
				isHierarchicalMemory: true,
			})
		})

		it("should not load duplicate memory files", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				return filePath === path.join("/project", "CLAUDE.md")
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === path.join("/project", "CLAUDE.md")) {
					return "# Project Memory\nThis is project root memory."
				}
				throw new Error("File not found")
			})

			// Load for the first file
			const result1 = await manager.loadFor("/project/src/file1.ts", "/project")
			expect(result1).toHaveLength(1)

			// Load for the second file in the same directory - should not reload the same memory
			const result2 = await manager.loadFor("/project/src/file2.ts", "/project")
			expect(result2).toHaveLength(0)
		})

		it("should handle file read errors gracefully", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("Permission denied"))

			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toEqual([])
		})

		it("should stop at root directory", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				return filePath === path.join("/project", "CLAUDE.md")
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === path.join("/project", "CLAUDE.md")) {
					return "# Project Memory"
				}
				throw new Error("File not found")
			})

			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toHaveLength(1)

			// Should not try to read beyond root
			expect(fs.readFile).not.toHaveBeenCalledWith(path.join("/", "CLAUDE.md"), "utf-8")
		})

		it("should handle multiple memory file names", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md", "Roorules.md", ".context.md"])

			// Mock file system
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				const fileName = path.basename(filePath.toString())
				const dirName = path.dirname(filePath.toString())

				return (
					(fileName === "CLAUDE.md" && dirName === "/project") ||
					(fileName === "Roorules.md" && dirName === "/project") ||
					(fileName === ".context.md" && dirName === "/project/src")
				)
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				const fileName = path.basename(filePath.toString())
				const dirName = path.dirname(filePath.toString())

				if (fileName === "CLAUDE.md" && dirName === "/project") {
					return "# CLAUDE Memory"
				}
				if (fileName === "Roorules.md" && dirName === "/project") {
					return "# Roo Rules"
				}
				if (fileName === ".context.md" && dirName === "/project/src") {
					return "# Context Memory"
				}
				throw new Error("File not found")
			})

			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toHaveLength(3)

			// Check that all three files were loaded
			const contents = result.map((msg) => msg.content.toString())
			expect(contents.some((c) => c.includes("Context Memory"))).toBe(true)
			expect(contents.some((c) => c.includes("CLAUDE Memory"))).toBe(true)
			expect(contents.some((c) => c.includes("Roo Rules"))).toBe(true)
		})

		it("should handle empty memory files", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system - only one file exists
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				return filePath === path.join("/project", "CLAUDE.md")
			})
			vi.mocked(fs.readFile).mockResolvedValue("")

			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toHaveLength(1) // Empty files are still loaded
		})

		it("should include content with whitespace", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system - only one file exists
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				return filePath === path.join("/project", "CLAUDE.md")
			})
			vi.mocked(fs.readFile).mockResolvedValue("\n\n  # Memory Content  \n\n")

			const result = await manager.loadFor("/project/src/file.ts", "/project")
			expect(result).toHaveLength(1)
			expect(result[0].content).toContain("# Memory Content")
		})
	})

	describe("edge cases", () => {
		it("should handle file path at root directory", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue("# Root Memory")

			const result = await manager.loadFor("/file.ts", "/")
			expect(result).toHaveLength(1)
		})

		it.skip("should handle Windows-style paths", async () => {
			// Skip this test on Unix systems as path handling is OS-specific
			// The implementation uses path.resolve which behaves differently on Windows vs Unix
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// Mock file system - handle Windows paths
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath) => {
				const fp = filePath.toString()
				return fp.endsWith("CLAUDE.md")
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				const fp = filePath.toString()
				if (fp.endsWith("CLAUDE.md")) {
					return "# Windows Memory"
				}
				throw new Error("File not found")
			})

			const result = await manager.loadFor("C:\\project\\src\\file.ts", "C:\\project")
			expect(result.length).toBeGreaterThanOrEqual(1)
		})

		it("should handle relative file paths by converting to absolute", async () => {
			manager = new HierarchicalMemoryManager(true, ["CLAUDE.md"])

			// For relative paths, the manager should still work correctly
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.readFile).mockResolvedValue("# Memory")

			const result = await manager.loadFor("./src/file.ts", ".")
			// Should still attempt to check for memory files
			expect(fileExistsAtPath).toHaveBeenCalled()
		})
	})
})
