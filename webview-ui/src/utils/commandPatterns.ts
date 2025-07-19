import { parse } from "shell-quote"

export interface CommandPattern {
	pattern: string
	description?: string
}

export interface SecurityWarning {
	type: "subshell" | "injection"
	message: string
}

export function extractCommandPatterns(command: string): string[] {
	if (!command?.trim()) return []

	const patterns = new Set<string>()

	try {
		// First, remove subshell expressions to avoid extracting their contents
		const cleanedCommand = command
			.replace(/\$\([^)]*\)/g, "") // Remove $() subshells
			.replace(/`[^`]*`/g, "") // Remove backtick subshells

		const parsed = parse(cleanedCommand)

		const commandSeparators = new Set(["|", "&&", "||", ";"])
		let current: any[] = []

		for (const token of parsed) {
			if (typeof token === "object" && "op" in token && token.op && commandSeparators.has(token.op)) {
				if (current.length) processCommand(current, patterns)
				current = []
			} else {
				current.push(token)
			}
		}

		if (current.length) processCommand(current, patterns)
	} catch (_error) {
		// If parsing fails, try to extract at least the main command
		const mainCommand = command.trim().split(/\s+/)[0]
		if (mainCommand) patterns.add(mainCommand)
	}

	return Array.from(patterns).sort()
}

function processCommand(cmd: any[], patterns: Set<string>) {
	if (!cmd.length || typeof cmd[0] !== "string") return

	const mainCmd = cmd[0]
	patterns.add(mainCmd)

	// Patterns that indicate we should stop looking for subcommands
	const breakingExps = [/^-/, /[\\/.~ ]/]

	// Build up patterns progressively
	for (let i = 1; i < cmd.length; i++) {
		const arg = cmd[i]
		if (typeof arg !== "string" || breakingExps.some((re) => re.test(arg))) break

		const pattern = cmd.slice(0, i + 1).join(" ")
		patterns.add(pattern)
	}
}

export function detectSecurityIssues(command: string): SecurityWarning[] {
	const warnings: SecurityWarning[] = []

	// Check for subshell execution attempts
	if (command.includes("$(") || command.includes("`")) {
		warnings.push({
			type: "subshell",
			message: "Command contains subshell execution which could bypass restrictions",
		})
	}

	return warnings
}

/**
 * Get a human-readable description for a command pattern.
 * Simply returns the pattern followed by "commands".
 */
export function getPatternDescription(pattern: string): string {
	return `${pattern} commands`
}

export function parseCommandAndOutput(text: string): {
	command: string
	output: string
	suggestions: string[]
} {
	// Default result
	const result = {
		command: text,
		output: "",
		suggestions: [] as string[],
	}

	// First check if the text already has been split by COMMAND_OUTPUT_STRING
	// This happens when the command has already been executed and we have the output
	const outputSeparator = "Output:"
	const outputIndex = text.indexOf(outputSeparator)

	if (outputIndex !== -1) {
		// Text is already split into command and output
		result.command = text.slice(0, outputIndex).trim()
		result.output = text.slice(outputIndex + outputSeparator.length).trim()
	} else {
		// Try to extract command from the text
		// Look for patterns like "$ command" or "❯ command" at the start
		const commandMatch = text.match(/^[$❯>]\s*(.+?)(?:\n|$)/m)
		if (commandMatch) {
			result.command = commandMatch[1].trim()
			result.output = text.substring(commandMatch.index! + commandMatch[0].length).trim()
		}
	}

	// Look for AI suggestions in the output
	// These might be in a format like:
	// "Suggested patterns: npm, npm install, npm run"
	// or as a list
	const suggestionPatterns = [
		/Suggested patterns?:\s*(.+?)(?:\n|$)/i,
		/Command patterns?:\s*(.+?)(?:\n|$)/i,
		/You (?:can|may|might) (?:want to )?(?:allow|add):\s*(.+?)(?:\n|$)/i,
	]

	for (const pattern of suggestionPatterns) {
		const match = result.output.match(pattern)
		if (match) {
			// Split by common delimiters and clean up
			const suggestions = match[1]
				.split(/[,;]/)
				.map((s) => s.trim())
				.filter((s) => s) // Allow multi-word patterns like "npm install"

			if (suggestions.length > 0) {
				// Add to existing suggestions instead of replacing
				result.suggestions.push(...suggestions)
			}
		}
	}

	// Remove duplicates
	result.suggestions = Array.from(new Set(result.suggestions))

	// Also look for bullet points or numbered lists
	// const listPattern = /^[\s\-*•·▪▫◦‣⁃]\s*`?([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)`?$/gm
	const lines = result.output.split("\n")
	for (const line of lines) {
		const match = line.match(/^[\s\-*•·▪▫◦‣⁃]\s*`?([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)`?$/)
		if (match && match[1] && !result.suggestions.includes(match[1])) {
			result.suggestions.push(match[1])
		}
	}

	return result
}
