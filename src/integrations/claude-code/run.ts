import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"

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
		/\n.*\$/, // Newline followed by shell prompt-like patterns
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

	// TODO: Is it worth using sessions? Where do we store the session ID?
	const args = [
		"-p",
		safeSerializeMessages(messages),
		"--system-prompt",
		systemPrompt,
		"--verbose",
		"--output-format",
		"stream-json",
		// Cline will handle recursive calls
		"--max-turns",
		"1",
	]

	if (modelId) {
		args.push("--model", modelId)
	}

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
