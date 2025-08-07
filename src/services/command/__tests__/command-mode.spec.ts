import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs/promises"
import * as path from "path"
import { getCommand, getCommands } from "../commands"

// Mock fs and path modules
vi.mock("fs/promises")
vi.mock("../roo-config", () => ({
	getGlobalRooDirectory: vi.fn(() => "/mock/global/.roo"),
	getProjectRooDirectoryForCwd: vi.fn(() => "/mock/project/.roo"),
}))

const mockFs = vi.mocked(fs)

describe("Command mode parameter", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getCommand with mode parameter", () => {
		it("should parse mode from frontmatter", async () => {
			const commandContent = `---
description: Deploy the application
argument-hint: <environment>
mode: architect
---

# Deploy Command

This command helps you deploy the application.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const command = await getCommand("/test/cwd", "deploy")

			expect(command).toBeDefined()
			expect(command?.name).toBe("deploy")
			expect(command?.description).toBe("Deploy the application")
			expect(command?.argumentHint).toBe("<environment>")
			expect(command?.mode).toBe("architect")
		})

		it("should handle commands without mode parameter", async () => {
			const commandContent = `---
description: Test command
argument-hint: <args>
---

# Test Command

This is a test command without mode.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const command = await getCommand("/test/cwd", "test")

			expect(command).toBeDefined()
			expect(command?.name).toBe("test")
			expect(command?.description).toBe("Test command")
			expect(command?.mode).toBeUndefined()
		})

		it("should handle commands with empty mode parameter", async () => {
			const commandContent = `---
description: Test command
mode: ""
---

# Test Command

This is a test command with empty mode.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const command = await getCommand("/test/cwd", "test")

			expect(command).toBeDefined()
			expect(command?.mode).toBeUndefined()
		})

		it("should trim whitespace from mode values", async () => {
			const commandContent = `---
description: Test command
mode: "  code  "
---

# Test Command

This is a test command with whitespace in mode.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const command = await getCommand("/test/cwd", "test")

			expect(command?.mode).toBe("code")
		})

		it("should handle non-string mode values", async () => {
			const commandContent = `---
description: Test command
mode: 123
---

# Test Command

This is a test command with non-string mode.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const command = await getCommand("/test/cwd", "test")

			expect(command?.mode).toBeUndefined()
		})
	})

	describe("getCommands with mode parameter", () => {
		it("should include mode parameter in command list", async () => {
			const deployContent = `---
description: Deploy the application
mode: architect
---

# Deploy Command

Deploy instructions.`

			const testContent = `---
description: Test command
mode: debug
---

# Test Command

Test instructions.`

			const simpleContent = `---
description: Simple command
---

# Simple Command

Simple instructions without mode.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readdir = vi.fn().mockResolvedValue([
				{ name: "deploy.md", isFile: () => true },
				{ name: "test.md", isFile: () => true },
				{ name: "simple.md", isFile: () => true },
			])
			mockFs.readFile = vi
				.fn()
				.mockResolvedValueOnce(deployContent)
				.mockResolvedValueOnce(testContent)
				.mockResolvedValueOnce(simpleContent)

			const commands = await getCommands("/test/cwd")

			expect(commands).toHaveLength(3)

			const deployCmd = commands.find((c) => c.name === "deploy")
			expect(deployCmd?.mode).toBe("architect")

			const testCmd = commands.find((c) => c.name === "test")
			expect(testCmd?.mode).toBe("debug")

			const simpleCmd = commands.find((c) => c.name === "simple")
			expect(simpleCmd?.mode).toBeUndefined()
		})

		it("should handle invalid mode values gracefully", async () => {
			const commandContent = `---
description: Test command
mode: [1, 2, 3]
---

# Test Command

Test content.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })
			mockFs.readdir = vi.fn().mockResolvedValue([{ name: "test.md", isFile: () => true }])
			mockFs.readFile = vi.fn().mockResolvedValue(commandContent)

			const commands = await getCommands("/test/cwd")

			expect(commands).toHaveLength(1)
			// Mode should be undefined since it's not a string
			expect(commands[0].mode).toBeUndefined()
		})
	})

	describe("Project commands override global commands with mode", () => {
		it("should use project command mode over global command", async () => {
			const projectDeployContent = `---
description: Project deploy
mode: architect
---

# Project Deploy

Project-specific deploy.`

			const globalDeployContent = `---
description: Global deploy
mode: code
---

# Global Deploy

Global deploy.`

			mockFs.stat = vi.fn().mockResolvedValue({ isDirectory: () => true })

			// Mock readdir for both global and project directories
			mockFs.readdir = vi.fn().mockImplementation((dirPath) => {
				if (dirPath.includes("global")) {
					return Promise.resolve([{ name: "deploy.md", isFile: () => true }])
				} else {
					return Promise.resolve([{ name: "deploy.md", isFile: () => true }])
				}
			})

			// Mock readFile for both global and project files
			mockFs.readFile = vi.fn().mockImplementation((filePath) => {
				if (filePath.includes("global")) {
					return Promise.resolve(globalDeployContent)
				} else {
					return Promise.resolve(projectDeployContent)
				}
			})

			const commands = await getCommands("/test/cwd")

			// Should only have one deploy command (project overrides global)
			const deployCommands = commands.filter((c) => c.name === "deploy")
			expect(deployCommands).toHaveLength(1)
			expect(deployCommands[0].mode).toBe("architect")
			expect(deployCommands[0].source).toBe("project")
		})
	})
})
