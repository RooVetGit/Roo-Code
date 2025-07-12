import { parse } from "shell-quote"

type ShellToken = string | { op: string } | { command: string }

/**
 * Split a command string into individual sub-commands by
 * chaining operators (&&, ||, ;, or |).
 *
 * Uses shell-quote to properly handle:
 * - Quoted strings (preserves quotes)
 * - Subshell commands ($(cmd) or `cmd`)
 * - PowerShell redirections (2>&1)
 * - Chain operators (&&, ||, ;, |)
 */
export function parseCommand(command: string): string[] {
	if (!command?.trim()) return []

	// Storage for replaced content
	const redirections: string[] = []
	const subshells: string[] = []
	const quotes: string[] = []
	const arrayIndexing: string[] = []

	// First handle PowerShell redirections by temporarily replacing them
	let processedCommand = command.replace(/\d*>&\d*/g, (match) => {
		redirections.push(match)
		return `__REDIR_${redirections.length - 1}__`
	})

	// Handle array indexing expressions: ${array[...]} pattern and partial expressions
	processedCommand = processedCommand.replace(/\$\{[^}]*\[[^\]]*(\]([^}]*\})?)?/g, (match) => {
		arrayIndexing.push(match)
		return `__ARRAY_${arrayIndexing.length - 1}__`
	})

	// Then handle subshell commands
	processedCommand = processedCommand
		.replace(/\$\((.*?)\)/g, (_, inner) => {
			subshells.push(inner.trim())
			return `__SUBSH_${subshells.length - 1}__`
		})
		.replace(/`(.*?)`/g, (_, inner) => {
			subshells.push(inner.trim())
			return `__SUBSH_${subshells.length - 1}__`
		})

	// Then handle quoted strings
	processedCommand = processedCommand.replace(/"[^"]*"/g, (match) => {
		quotes.push(match)
		return `__QUOTE_${quotes.length - 1}__`
	})

	const tokens = parse(processedCommand) as ShellToken[]
	const commands: string[] = []
	let currentCommand: string[] = []

	for (const token of tokens) {
		if (typeof token === "object" && "op" in token) {
			// Chain operator - split command
			if (["&&", "||", ";", "|"].includes(token.op)) {
				if (currentCommand.length > 0) {
					commands.push(currentCommand.join(" "))
					currentCommand = []
				}
			} else {
				// Other operators (>, &) are part of the command
				currentCommand.push(token.op)
			}
		} else if (typeof token === "string") {
			// Check if it's a subshell placeholder
			const subshellMatch = token.match(/__SUBSH_(\d+)__/)
			if (subshellMatch) {
				if (currentCommand.length > 0) {
					commands.push(currentCommand.join(" "))
					currentCommand = []
				}
				commands.push(subshells[parseInt(subshellMatch[1])])
			} else {
				currentCommand.push(token)
			}
		}
	}

	// Add any remaining command
	if (currentCommand.length > 0) {
		commands.push(currentCommand.join(" "))
	}

	// Restore quotes and redirections
	return commands.map((cmd) => {
		let result = cmd
		// Restore quotes
		result = result.replace(/__QUOTE_(\d+)__/g, (_, i) => quotes[parseInt(i)])
		// Restore redirections
		result = result.replace(/__REDIR_(\d+)__/g, (_, i) => redirections[parseInt(i)])
		// Restore array indexing expressions
		result = result.replace(/__ARRAY_(\d+)__/g, (_, i) => arrayIndexing[parseInt(i)])
		return result
	})
}

/**
 * Find the longest matching prefix from a list of prefixes for a given command.
 */
export function findLongestPrefixMatch(command: string, prefixes: string[]): string | null {
	if (!command || !prefixes?.length) return null

	const trimmedCommand = command.trim().toLowerCase()
	let longestMatch: string | null = null

	for (const prefix of prefixes) {
		const lowerPrefix = prefix.toLowerCase()
		// Handle wildcard "*" - it matches any command
		if (lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)) {
			if (!longestMatch || lowerPrefix.length > longestMatch.length) {
				longestMatch = lowerPrefix
			}
		}
	}

	return longestMatch
}

/**
 * Check if a single command should be auto-approved.
 * Returns true only for commands that explicitly match the allowlist
 * and either don't match the denylist or have a longer allowlist match.
 *
 * Special handling for wildcards: "*" in allowlist allows any command,
 * but denylist can still block specific commands.
 */
export function isAutoApprovedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) return true

	// If no allowlist configured, nothing can be auto-approved
	if (!allowedCommands?.length) return false

	// Check if wildcard is present in allowlist
	const hasWildcard = allowedCommands.some((cmd) => cmd.toLowerCase() === "*")

	// If no denylist provided (undefined), use simple allowlist logic
	if (deniedCommands === undefined) {
		const trimmedCommand = command.trim().toLowerCase()
		return allowedCommands.some((prefix) => {
			const lowerPrefix = prefix.toLowerCase()
			// Handle wildcard "*" - it matches any command
			return lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)
		})
	}

	// Find longest matching prefix in both lists
	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands)

	// Special case: if wildcard is present and no denylist match, auto-approve
	if (hasWildcard && !longestDeniedMatch) return true

	// Must have an allowlist match to be auto-approved
	if (!longestAllowedMatch) return false

	// If no denylist match, auto-approve
	if (!longestDeniedMatch) return true

	// Both have matches - allowlist must be longer to auto-approve
	return longestAllowedMatch.length > longestDeniedMatch.length
}

/**
 * Check if a single command should be auto-denied.
 * Returns true only for commands that explicitly match the denylist
 * and either don't match the allowlist or have a longer denylist match.
 */
export function isAutoDeniedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) return false

	// If no denylist configured, nothing can be auto-denied
	if (!deniedCommands?.length) return false

	// Find longest matching prefix in both lists
	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands || [])

	// Must have a denylist match to be auto-denied
	if (!longestDeniedMatch) return false

	// If no allowlist match, auto-deny
	if (!longestAllowedMatch) return true

	// Both have matches - denylist must be longer or equal to auto-deny
	return longestDeniedMatch.length >= longestAllowedMatch.length
}

/**
 * Check if a command string should be auto-approved.
 * Only blocks subshell attempts if there's a denylist configured.
 * Requires all sub-commands to be auto-approved.
 */
export function isAutoApprovedCommand(command: string, allowedCommands: string[], deniedCommands?: string[]): boolean {
	if (!command?.trim()) return true

	// Only block subshell execution attempts if there's a denylist configured
	if ((command.includes("$(") || command.includes("`")) && deniedCommands?.length) {
		return false
	}

	// Parse into sub-commands (split by &&, ||, ;, |)
	const subCommands = parseCommand(command)

	// Ensure every sub-command is auto-approved
	return subCommands.every((cmd) => {
		// Remove simple PowerShell-like redirections (e.g. 2>&1) before checking
		const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, "").trim()

		return isAutoApprovedSingleCommand(cmdWithoutRedirection, allowedCommands, deniedCommands)
	})
}

/**
 * Check if a command string should be auto-denied.
 * Only blocks subshell attempts if there's a denylist configured.
 * Auto-denies if any sub-command is auto-denied.
 */
export function isAutoDeniedCommand(command: string, allowedCommands: string[], deniedCommands?: string[]): boolean {
	if (!command?.trim()) return false

	// Only block subshell execution attempts if there's a denylist configured
	if ((command.includes("$(") || command.includes("`")) && deniedCommands?.length) {
		return true
	}

	// Parse into sub-commands (split by &&, ||, ;, |)
	const subCommands = parseCommand(command)

	// Auto-deny if any sub-command is auto-denied
	return subCommands.some((cmd) => {
		// Remove simple PowerShell-like redirections (e.g. 2>&1) before checking
		const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, "").trim()

		return isAutoDeniedSingleCommand(cmdWithoutRedirection, allowedCommands, deniedCommands)
	})
}

/**
 * Command approval decision types
 */
export type CommandDecision = "auto_approve" | "auto_deny" | "ask_user"

/**
 * Unified command validation that implements the longest prefix match rule.
 * Returns a definitive decision for a command based on allowlist and denylist.
 *
 * Logic:
 * 1. If subshells are present and denylist exists, auto-deny
 * 2. Parse command into sub-commands
 * 3. For each sub-command, find longest matches in both lists
 * 4. Apply longest prefix match rule to determine decision
 * 5. If any sub-command is denied, deny the whole command
 * 6. If all sub-commands are approved, approve the whole command
 * 7. Otherwise, ask user
 */
export function getCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command?.trim()) return "auto_approve"

	// Only block subshell execution attempts if there's a denylist configured
	if ((command.includes("$(") || command.includes("`")) && deniedCommands?.length) {
		return "auto_deny"
	}

	// Parse into sub-commands (split by &&, ||, ;, |)
	const subCommands = parseCommand(command)

	// Check each sub-command and collect decisions
	const decisions: CommandDecision[] = subCommands.map((cmd) => {
		// Remove simple PowerShell-like redirections (e.g. 2>&1) before checking
		const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, "").trim()

		return getSingleCommandDecision(cmdWithoutRedirection, allowedCommands, deniedCommands)
	})

	// If any sub-command is denied, deny the whole command
	if (decisions.includes("auto_deny")) {
		return "auto_deny"
	}

	// If all sub-commands are approved, approve the whole command
	if (decisions.every((decision) => decision === "auto_approve")) {
		return "auto_approve"
	}

	// Otherwise, ask user
	return "ask_user"
}

/**
 * Get the decision for a single command using longest prefix match rule.
 * This is the core logic that implements the conflict resolution between
 * allowlist and denylist.
 */
export function getSingleCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command) return "auto_approve"

	// Find longest matching prefixes in both lists
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands || [])
	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands || [])

	// If only allowlist has a match, auto-approve
	if (longestAllowedMatch && !longestDeniedMatch) {
		return "auto_approve"
	}

	// If only denylist has a match, auto-deny
	if (!longestAllowedMatch && longestDeniedMatch) {
		return "auto_deny"
	}

	// Both lists have matches - apply longest prefix match rule
	if (longestAllowedMatch && longestDeniedMatch) {
		return longestAllowedMatch.length > longestDeniedMatch.length ? "auto_approve" : "auto_deny"
	}

	// If neither list has a match, ask user
	return "ask_user"
}
