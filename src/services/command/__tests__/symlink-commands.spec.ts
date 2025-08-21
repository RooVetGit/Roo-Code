import { describe, it, expect, beforeEach, vi } from "vitest"
import fs from "fs/promises"
import * as path from "path"
import { getCommands, getCommand } from "../commands"

// Mock fs and path modules
vi.mock("fs/promises")
vi.mock("../../roo-config", () => ({
	getGlobalRooDirectory: vi.fn(() => "/mock/global"),
	getProjectRooDirectoryForCwd: vi.fn(() => "/mock/project"),
}))

const mockFs = vi.mocked(fs)

describe("Symbolic link support for commands", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getCommands with symbolic links", () => {
		it("should load commands from symbolic links", async () => {
			const setupContent = `---
description: Sets up the development environment
---

# Setup Command

Setup instructions.`

			const deployContent = `---
description: Deploys the application
---

# Deploy Command

Deploy instructions.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readdir = vi.fn().mockResolvedValue([
				{ name: "setup.md", isFile: () => false, isSymbolicLink: () => true }, // Symbolic link
				{ name: "deploy.md", isFile: () => true, isSymbolicLink: () => false }, // Regular file
				{ name: "build.md", isFile: () => false, isSymbolicLink: () => true }, // Another symbolic link
			])
			mockFs.readFile = vi
				.fn()
				.mockResolvedValueOnce(setupContent)
				.mockResolvedValueOnce(deployContent)
				.mockResolvedValueOnce("# Build Command\n\nBuild instructions.")

			const result = await getCommands("/test/cwd")

			expect(result).toHaveLength(3)
			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: "setup",
						description: "Sets up the development environment",
					}),
					expect.objectContaining({
						name: "deploy",
						description: "Deploys the application",
					}),
					expect.objectContaining({
						name: "build",
						description: undefined,
					}),
				]),
			)
		})

		it("should handle mix of regular files and symbolic links", async () => {
			const testContent = `---
description: Test command
argument-hint: test | debug
---

# Test Command

Test content.`

			const linkContent = `---
description: Linked command
---

# Linked Command

This command is accessed via symbolic link.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readdir = vi.fn().mockResolvedValue([
				{ name: "test.md", isFile: () => true, isSymbolicLink: () => false }, // Regular file
				{ name: "linked.md", isFile: () => false, isSymbolicLink: () => true }, // Symbolic link
				{ name: "not-markdown.txt", isFile: () => true, isSymbolicLink: () => false }, // Should be ignored
				{ name: "symlink.txt", isFile: () => false, isSymbolicLink: () => true }, // Non-markdown symlink, should be ignored
			])
			mockFs.readFile = vi.fn().mockResolvedValueOnce(testContent).mockResolvedValueOnce(linkContent)

			const result = await getCommands("/test/cwd")

			expect(result).toHaveLength(2)
			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: "test",
						description: "Test command",
						argumentHint: "test | debug",
					}),
					expect.objectContaining({
						name: "linked",
						description: "Linked command",
					}),
				]),
			)
		})

		it("should handle broken symbolic links gracefully", async () => {
			const validContent = `# Valid Command

This is a valid command.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readdir = vi.fn().mockResolvedValue([
				{ name: "valid.md", isFile: () => true, isSymbolicLink: () => false }, // Regular file
				{ name: "broken-link.md", isFile: () => false, isSymbolicLink: () => true }, // Broken symbolic link
			])
			mockFs.readFile = vi
				.fn()
				.mockResolvedValueOnce(validContent)
				.mockRejectedValueOnce(new Error("ENOENT: no such file or directory")) // Broken link

			const result = await getCommands("/test/cwd")

			// Should only load the valid command, ignoring the broken link
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual(
				expect.objectContaining({
					name: "valid",
				}),
			)
		})

		it("should prioritize project symbolic links over global commands", async () => {
			const projectSymlinkContent = `---
description: Project symbolic link command
---

# Project Symlink

Project-specific command via symlink.`

			const globalContent = `---
description: Global command
---

# Global Command

Global command content.`

			// Mock both directories
			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })

			// First call for global directory scan, second for project directory scan
			mockFs.readdir = vi
				.fn()
				.mockResolvedValueOnce([
					{ name: "override.md", isFile: () => true, isSymbolicLink: () => false }, // Global regular file
				])
				.mockResolvedValueOnce([
					{ name: "override.md", isFile: () => false, isSymbolicLink: () => true }, // Project symlink
				])

			// First read is for global file, second is for project symlink
			mockFs.readFile = vi.fn().mockResolvedValueOnce(globalContent).mockResolvedValueOnce(projectSymlinkContent)

			const result = await getCommands("/test/cwd")

			// Project symbolic link should override global command
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual(
				expect.objectContaining({
					name: "override",
					description: "Project symbolic link command",
					source: "project",
				}),
			)
		})
	})

	describe("getCommand with symbolic links", () => {
		it("should load a command from a symbolic link", async () => {
			const commandContent = `---
description: Command accessed via symbolic link
argument-hint: option1 | option2
---

# Symlinked Command

This command is loaded from a symbolic link.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const result = await getCommand("/test/cwd", "symlinked")

			expect(result).toEqual({
				name: "symlinked",
				content: "# Symlinked Command\n\nThis command is loaded from a symbolic link.",
				source: "project",
				filePath: path.join("/mock/project", "commands", "symlinked.md"),
				description: "Command accessed via symbolic link",
				argumentHint: "option1 | option2",
			})
		})
	})
})
