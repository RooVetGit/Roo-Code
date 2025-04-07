/**
 * Implementation of notebook_save tool
 *
 * This tool allows saving the notebook but requires notebook_edit approval
 */
import * as vscode from "vscode"
import type { Cline } from "../Cline"
import type { ClineAsk } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import type { ToolParamName } from "../assistant-message"

type ToolUseBlock = {
	name: string
	params: Record<string, string>
	partial: boolean
}

/**
 * Implementation of the notebook_save tool
 */
export async function notebookSaveTool(
	cline: Cline,
	block: ToolUseBlock,
	askApproval: (type: ClineAsk, partialMessage?: string) => Promise<boolean>,
	handleError: (action: string, error: Error) => Promise<void>,
	pushToolResult: (content: string) => void,
	removeClosingTag: (tag: ToolParamName, text?: string) => string,
) {
	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "saveNotebook",
						content: "",
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		cline.consecutiveMistakeCount = 0

		// Ask for approval BEFORE checking any conditions
		const approvalProps = {
			tool: "saveNotebook",
		}

		// We're reusing the same approval as notebook_edit, so it will be
		// auto-approved if notebook_edit is auto-approved
		const didApprove = await askApproval("tool", JSON.stringify(approvalProps))
		if (!didApprove) {
			return
		}

		// Only proceed with notebook operations after approval
		try {
			// Check if there is an active notebook
			const notebookEditor = vscode.window.activeNotebookEditor
			if (!notebookEditor) {
				const errorMsg = "No active notebook found. Please open a notebook first."
				await cline.say("error", errorMsg)
				pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Save the notebook using the workspace API
			await vscode.workspace.save(notebookEditor.notebook.uri)
			pushToolResult(`Notebook saved successfully: ${notebookEditor.notebook.uri.fsPath}`)
		} catch (error) {
			const errorMsg = `Error saving notebook: ${error instanceof Error ? error.message : String(error)}`
			await cline.say("error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
		}
	} catch (error) {
		await handleError("executing notebook_save tool", error instanceof Error ? error : new Error(String(error)))
	}
}
