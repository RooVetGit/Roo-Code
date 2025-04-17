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
 * Implementation of the notebook_execute tool
 */
export async function notebookExecuteTool(
	cline: Cline,
	block: ToolUseBlock,
	askApproval: (type: ClineAsk, partialMessage?: string) => Promise<boolean>,
	handleError: (action: string, error: Error) => Promise<void>,
	pushToolResult: (content: string) => void,
	removeClosingTag: (tag: ToolParamName, text?: string) => string,
) {
	const action: string | undefined = block.params.action
	const startIndex: string | undefined = block.params.start_index
	const endIndex: string | undefined = block.params.end_index

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "executeNotebook",
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
			pushToolResult(await cline.sayAndCreateMissingParamError("notebook_execute", "action"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Validate inputs before asking for approval
		let validationError = ""

		switch (action) {
			case "execute_cells":
				if (!startIndex) {
					validationError = "Missing required parameter: start_index"
				} else if (!endIndex) {
					validationError = "Missing required parameter: end_index"
				}
				break

			default:
				validationError = `Unknown action: ${action}. Valid actions for notebook_execute are: execute_cells.`
		}

		if (validationError) {
			cline.consecutiveMistakeCount++
			await cline.say("error", validationError)
			pushToolResult(formatResponse.toolError(validationError))
			return
		}

		const approvalProps: any = {
			tool: "executeNotebook",
			action: removeClosingTag("action", action),
		}

		if (startIndex) {
			approvalProps.start_index = parseInt(removeClosingTag("start_index", startIndex))
		}
		if (endIndex) {
			approvalProps.end_index = parseInt(removeClosingTag("end_index", endIndex))
		}

		// Ask for approval BEFORE executing the operation
		const didApprove = await askApproval("tool", JSON.stringify(approvalProps))
		if (!didApprove) {
			return
		}

		// Now actually execute the operation after approval
		try {
			const { NotebookService } = await import("../../services/notebook")

			// Get notebook output settings from provider's state with fallback values
			const state = (await cline.providerRef.deref()?.getState()) || {}
			const maxOutputSize = (state as any).notebookOutputSizeLimit ?? 2000
			const timeoutSeconds = (state as any).notebookExecutionTimeoutSeconds ?? 30

			// Create validation callback that validates the indices using snake_case in error messages
			const validateIndices = (cellCount: number) => {
				const parsedStartIndex = parseInt(startIndex!)
				const parsedEndIndex = parseInt(endIndex!)

				if (parsedStartIndex < 0 || parsedStartIndex >= cellCount) {
					throw new Error(`Invalid start_index: ${parsedStartIndex}. Valid range is 0-${cellCount - 1}.`)
				}

				if (parsedEndIndex <= parsedStartIndex || parsedEndIndex > cellCount) {
					throw new Error(
						`Invalid end_index: ${parsedEndIndex}. Must be > ${parsedStartIndex} and <= ${cellCount}.`,
					)
				}

				return { startIndex: parsedStartIndex, endIndex: parsedEndIndex }
			}

			const result = await NotebookService.executeCells(validateIndices, maxOutputSize, timeoutSeconds)

			pushToolResult(result)
		} catch (error) {
			const errorMsg = `Error executing notebook_execute tool: ${error instanceof Error ? error.message : String(error)}`
			await cline.say("error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
		}
	} catch (error) {
		await handleError("executing notebook_execute tool", error)
	}
}
