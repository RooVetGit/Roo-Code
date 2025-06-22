import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { execa } from "execa"

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
	const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

	// TODO: Is it worth using sessions? Where do we store the session ID?
	const args = [
		"-p",
		JSON.stringify(messages),
		"--system-prompt",
		systemPrompt,
		"--verbose",
		"--output-format",
		"stream-json",
		// Roo Code will handle recursive calls
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
		cwd,
	})
}
