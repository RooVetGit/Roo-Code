import { describe, it, expect } from "vitest"
import { getBuiltInCommands, getBuiltInCommand, getBuiltInCommandNames } from "../built-in-commands"

describe("Built-in Commands", () => {
	describe("getBuiltInCommands", () => {
		it("should return all built-in commands", async () => {
			const commands = await getBuiltInCommands()

			expect(commands).toHaveLength(2)
			expect(commands.map((cmd) => cmd.name)).toEqual(expect.arrayContaining(["init", "create-mode"]))

			// Verify all commands have required properties
			commands.forEach((command) => {
				expect(command.name).toBeDefined()
				expect(typeof command.name).toBe("string")
				expect(command.content).toBeDefined()
				expect(typeof command.content).toBe("string")
				expect(command.source).toBe("built-in")
				expect(command.filePath).toMatch(/^<built-in:.+>$/)
				expect(command.description).toBeDefined()
				expect(typeof command.description).toBe("string")
			})
		})

		it("should return commands with proper content", async () => {
			const commands = await getBuiltInCommands()

			const initCommand = commands.find((cmd) => cmd.name === "init")
			expect(initCommand).toBeDefined()
			expect(initCommand!.content).toContain("Initialize Roo Project")
			expect(initCommand!.content).toContain(".roo/rules/")
			expect(initCommand!.description).toBe("Initialize a Roo project with recommended rules and configuration")

			const createModeCommand = commands.find((cmd) => cmd.name === "create-mode")
			expect(createModeCommand).toBeDefined()
			expect(createModeCommand!.content).toContain("Create a Custom Mode")
			expect(createModeCommand!.content).toContain("YAML")
			expect(createModeCommand!.description).toBe("Create a custom mode for specialized AI assistance")
		})
	})

	describe("getBuiltInCommand", () => {
		it("should return specific built-in command by name", async () => {
			const initCommand = await getBuiltInCommand("init")

			expect(initCommand).toBeDefined()
			expect(initCommand!.name).toBe("init")
			expect(initCommand!.source).toBe("built-in")
			expect(initCommand!.filePath).toBe("<built-in:init>")
			expect(initCommand!.content).toContain("Initialize Roo Project")
			expect(initCommand!.description).toBe("Initialize a Roo project with recommended rules and configuration")
		})

		it("should return create-mode command", async () => {
			const createModeCommand = await getBuiltInCommand("create-mode")

			expect(createModeCommand).toBeDefined()
			expect(createModeCommand!.name).toBe("create-mode")
			expect(createModeCommand!.source).toBe("built-in")
			expect(createModeCommand!.filePath).toBe("<built-in:create-mode>")
			expect(createModeCommand!.content).toContain("Create a Custom Mode")
			expect(createModeCommand!.description).toBe("Create a custom mode for specialized AI assistance")
		})

		it("should return undefined for non-existent command", async () => {
			const nonExistentCommand = await getBuiltInCommand("non-existent")
			expect(nonExistentCommand).toBeUndefined()
		})

		it("should handle empty string command name", async () => {
			const emptyCommand = await getBuiltInCommand("")
			expect(emptyCommand).toBeUndefined()
		})
	})

	describe("getBuiltInCommandNames", () => {
		it("should return all built-in command names", async () => {
			const names = await getBuiltInCommandNames()

			expect(names).toHaveLength(2)
			expect(names).toEqual(expect.arrayContaining(["init", "create-mode"]))
			// Order doesn't matter since it's based on filesystem order
			expect(names.sort()).toEqual(["create-mode", "init"])
		})

		it("should return array of strings", async () => {
			const names = await getBuiltInCommandNames()

			names.forEach((name) => {
				expect(typeof name).toBe("string")
				expect(name.length).toBeGreaterThan(0)
			})
		})
	})

	describe("Command Content Validation", () => {
		it("init command should have comprehensive content", async () => {
			const command = await getBuiltInCommand("init")
			const content = command!.content

			// Should contain key sections
			expect(content).toContain("What this command does:")
			expect(content).toContain("Recommended starter rules:")
			expect(content).toContain("Getting Started:")
			expect(content).toContain("Example rule file structure:")

			// Should mention important concepts
			expect(content).toContain("code-style.md")
			expect(content).toContain("project-context.md")
			expect(content).toContain("testing.md")
			expect(content).toContain("@rules")
		})

		it("create-mode command should have comprehensive content", async () => {
			const command = await getBuiltInCommand("create-mode")
			const content = command!.content

			// Should contain key sections
			expect(content).toContain("What are Modes?")
			expect(content).toContain("Mode Configuration")
			expect(content).toContain("Mode Properties")
			expect(content).toContain("Creating Your Mode")
			expect(content).toContain("Mode Examples")
			expect(content).toContain("Best Practices")

			// Should mention important concepts
			expect(content).toContain("YAML")
			expect(content).toContain("instructions")
			expect(content).toContain("file_restrictions")
			expect(content).toContain("tools")
		})
	})
})
