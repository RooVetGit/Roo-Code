import type { Cline } from "../Cline"
import type { ClineAsk } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolParamName } from "../assistant-message"

type ToolUseBlock = {
	name: string
	params: Record<string, string>
	partial: boolean
}

/**
 * Implementation of the notebook_read tool
 */
export async function notebookReadTool(
	cline: Cline,
	block: ToolUseBlock,
	askApproval: (type: ClineAsk, partialMessage?: string) => Promise<boolean>,
	handleError: (action: string, error: Error) => Promise<void>,
	pushToolResult: (content: string) => void,
	removeClosingTag: (tag: ToolParamName, text?: string) => string,
) {
	const action: string | undefined = block.params.action

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "readNotebook",
						action: removeClosingTag("action", action),
						content: "",
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		if (!action) {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_read", "action"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Ask for approval first with just the action info
		const approvalMessage = JSON.stringify({
			tool: "readNotebook",
			action: removeClosingTag("action", action),
		})

		const didApprove = await askApproval("tool", approvalMessage)
		if (!didApprove) {
			return
		}

		// Only read the notebook after approval
		let result = ""
		let success = false

		try {
			const { NotebookService } = await import("../../services/notebook")

			// Get notebook output setting from provider state
			const state = await cline.providerRef.deref()?.getState()
			const maxOutputSize = state?.notebookMaxOutputSize ?? 2000

			switch (action) {
				case "get_info":
					result = await NotebookService.getNotebookInfo()
					success = true
					break

				case "get_cells":
					result = await NotebookService.getCells(maxOutputSize)
					success = true
					break

				default:
					result = `Unknown action: ${action}. Valid actions for notebook_read are: get_info, get_cells.`
					success = false
			}
		} catch (error) {
			result = `Error executing notebook_read tool: ${error instanceof Error ? error.message : String(error)}`
			success = false
		}

		if (success) {
			pushToolResult(result)
		} else {
			await cline.say("error", result)
			pushToolResult(formatResponse.toolError(result))
		}
	} catch (error) {
		await handleError("executing notebook_read tool", error)
	}
}
