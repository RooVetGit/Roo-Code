import fs from "fs/promises"
import * as path from "path"
import matter from "gray-matter"
import { Command } from "./commands"

/**
 * Get the path to the built-in commands directory
 */
function getBuiltInCommandsDirectory(): string {
	// Handle both development and compiled extension environments
	// In development: __dirname = /path/to/src/services/command
	// In compiled: __dirname = /path/to/src/dist/services/command

	if (__dirname.includes("/dist/")) {
		// Compiled extension: navigate from dist/services/command to dist/assets/built-in-commands
		return path.join(__dirname, "..", "..", "assets", "built-in-commands")
	} else {
		// Development: navigate from src/services/command to src/assets/built-in-commands
		return path.join(__dirname, "..", "assets", "built-in-commands")
	}
}

/**
 * Load a built-in command from a markdown file
 */
async function loadBuiltInCommandFromFile(filePath: string, name: string): Promise<Command | undefined> {
	try {
		const content = await fs.readFile(filePath, "utf-8")

		let parsed
		let description: string | undefined
		let argumentHint: string | undefined
		let commandContent: string

		try {
			// Try to parse frontmatter with gray-matter
			parsed = matter(content)
			description =
				typeof parsed.data.description === "string" && parsed.data.description.trim()
					? parsed.data.description.trim()
					: undefined
			argumentHint =
				typeof parsed.data["argument-hint"] === "string" && parsed.data["argument-hint"].trim()
					? parsed.data["argument-hint"].trim()
					: undefined
			commandContent = parsed.content.trim()
		} catch (frontmatterError) {
			// If frontmatter parsing fails, treat the entire content as command content
			description = undefined
			argumentHint = undefined
			commandContent = content.trim()
		}

		return {
			name,
			content: commandContent,
			source: "built-in",
			filePath: `<built-in:${name}>`,
			description,
			argumentHint,
		}
	} catch (error) {
		// File doesn't exist or can't be read
		return undefined
	}
}

/**
 * Get all built-in commands as Command objects
 */
export async function getBuiltInCommands(): Promise<Command[]> {
	const commands: Command[] = []
	const builtInCommandsDir = getBuiltInCommandsDirectory()

	try {
		const entries = await fs.readdir(builtInCommandsDir, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
				const commandName = entry.name.slice(0, -3) // Remove .md extension
				const filePath = path.join(builtInCommandsDir, entry.name)

				const command = await loadBuiltInCommandFromFile(filePath, commandName)
				if (command) {
					commands.push(command)
				}
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read - this is fine, just return empty array
		console.warn("Built-in commands directory not found or not readable:", error)
	}

	return commands
}

/**
 * Get a specific built-in command by name
 */
export async function getBuiltInCommand(name: string): Promise<Command | undefined> {
	const builtInCommandsDir = getBuiltInCommandsDirectory()
	const filePath = path.join(builtInCommandsDir, `${name}.md`)

	return await loadBuiltInCommandFromFile(filePath, name)
}

/**
 * Get names of all built-in commands
 */
export async function getBuiltInCommandNames(): Promise<string[]> {
	const commands = await getBuiltInCommands()
	return commands.map((cmd) => cmd.name)
}
