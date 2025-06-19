import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"
import { access, constants } from "fs/promises"

// Safely get the workspace folder, handling test environments
const getCwd = () => {
	try {
		return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
	} catch {
		// In test environments, vscode.workspace might not be available
		return undefined
	}
}

export async function runClaudeCode({
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

	// Check if the Claude CLI binary exists and is executable
	try {
		await access(claudePath, constants.F_OK | constants.X_OK)
	} catch (error) {
		throw new Error(`Claude Code CLI not found or not executable at: ${claudePath}. ${error.message}`)
	}

	// TODO: Is it worth using sessions? Where do we store the session ID?
	const args = [
		"-p",
		JSON.stringify(messages),
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
		return await execa(claudePath, args, {
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
