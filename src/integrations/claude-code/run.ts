import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"

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

	return execa(claudePath, args, {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: process.env,
		cwd: getCwd(),
	})
}
