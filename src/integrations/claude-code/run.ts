import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"
import { randomUUID } from "crypto"

/**
 * Validates that a string doesn't contain shell escape sequences or dangerous characters
 * that could be interpreted by the shell even when passed as arguments to execa.
 */
function validateMessageContent(content: string): void {
	// Check for common shell escape sequences and dangerous patterns
	const dangerousPatterns = [
		// eslint-disable-next-line no-control-regex
		/\x1b\[/, // ANSI escape sequences
		/\$\(/, // Command substitution
		/`/, // Backticks for command substitution
		/\|\|/, // Logical OR that could chain commands
		/&&/, // Logical AND that could chain commands
		/;/, // Command separator
		/\n\s*[\w-]*\$\s/, // Newline followed by shell prompt patterns (e.g., "user$ ", "$ ")
	]

	for (const pattern of dangerousPatterns) {
		if (pattern.test(content)) {
			throw new Error(`Message content contains potentially dangerous shell sequences: ${pattern}`)
		}
	}
}

/**
 * Safely serializes messages for CLI consumption.
 * This function expects trusted input only - messages should come from
 * authenticated Anthropic API responses or user input that has been
 * validated by the extension.
 */
function safeSerializeMessages(messages: Anthropic.Messages.MessageParam[]): string {
	// Validate each message content for potential shell injection
	for (const message of messages) {
		if (typeof message.content === "string") {
			validateMessageContent(message.content)
		} else if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "text" && typeof block.text === "string") {
					validateMessageContent(block.text)
				}
			}
		}
	}

	return JSON.stringify(messages)
}

// Safely get the workspace folder, handling test environments
const getCwd = () => {
	try {
		return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
	} catch {
		// In test environments, vscode.workspace might not be available
		return undefined
	}
}

/**
 * Session manager for Claude Code CLI sessions per workspace
 */
class SessionManager {
	private static sessions = new Map<string, string>()

	/**
	 * Get or create a session ID for the current workspace
	 */
	static getSessionId(workspacePath?: string): string {
		const workspaceKey = workspacePath || "default"

		let sessionId = this.sessions.get(workspaceKey)
		if (!sessionId) {
			sessionId = randomUUID()
			this.sessions.set(workspaceKey, sessionId)
		}

		return sessionId
	}

	/**
	 * Clear session for a specific workspace
	 */
	static clearSession(workspacePath?: string): void {
		const workspaceKey = workspacePath || "default"
		this.sessions.delete(workspaceKey)
	}

	/**
	 * Clear all sessions
	 */
	static clearAllSessions(): void {
		this.sessions.clear()
	}
}

export { SessionManager }

export function runClaudeCode({
	systemPrompt,
	messages,
	path,
	modelId,
}: {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	path?: string
	modelId?: string
}) {
	const claudePath = path || "claude"
	const workspacePath = getCwd()
	const sessionId = SessionManager.getSessionId(workspacePath)

	// Convert messages to a simple text prompt since Claude CLI doesn't accept JSON messages
	let promptText = ""

	// Add system prompt if provided
	if (systemPrompt) {
		promptText += `System: ${systemPrompt}\n\n`
	}

	// Convert messages to text format
	for (const message of messages) {
		const role = message.role === "user" ? "User" : "Assistant"
		let content = ""

		if (typeof message.content === "string") {
			content = message.content
		} else if (Array.isArray(message.content)) {
			// Extract text from content blocks
			content = message.content
				.filter((block) => block.type === "text")
				.map((block) => (block as any).text)
				.join("\n")
		}

		// Validate the content for security
		validateMessageContent(content)

		promptText += `${role}: ${content}\n\n`
	}

	const args = ["-p", promptText.trim(), "--verbose", "--output-format", "stream-json"]

	// Add model if specified
	if (modelId) {
		args.push("--model", modelId)
	}

	// Note: Removed -r option as it requires an existing session ID from Claude CLI
	// Each call will be treated as a new conversation for now

	try {
		return execa(claudePath, args, {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			env: process.env,
			cwd: getCwd(),
		})
	} catch (error) {
		throw new Error(`Failed to execute Claude Code CLI at '${claudePath}': ${error.message}`)
	}
}
