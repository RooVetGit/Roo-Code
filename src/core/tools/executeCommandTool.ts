import { Cline } from "../Cline"
import { ToolUse } from "../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { formatResponse } from "../prompts/responses"
import { CommandRiskLevel, commandRiskLevels } from "../../schemas"

// Function to validate risk level
export const isValidRiskLevel = (risk: string): boolean => {
	return risk !== undefined && risk !== "none" && commandRiskLevels.includes(risk as CommandRiskLevel)
}

// Function to check if risk is allowed
export const isRiskAllowed = (userRiskLevel: CommandRiskLevel, cmdRiskLevel: CommandRiskLevel): boolean => {
	if (userRiskLevel === "none") return false
	const userRiskIndex = commandRiskLevels.indexOf(userRiskLevel)
	const cmdRiskIndex = commandRiskLevels.indexOf(cmdRiskLevel)
	return cmdRiskIndex <= userRiskIndex
}

export async function executeCommandTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	let command: string | undefined = block.params.command
	const customCwd: string | undefined = block.params.cwd
	const commandRisk: string | undefined = block.params.risk
	const metadata = commandRisk ? { risk: commandRisk } : undefined

	try {
		if (block.partial) {
			await cline
				.ask("command", removeClosingTag("command", command), block.partial, undefined, metadata)
				.catch(() => {})
			return
		} else {
			if (!command) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("execute_command", "command"))
				return
			}

			if (!commandRisk) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("execute_command", "risk"))
				return
			}

			const ignoredFileAttemptedToAccess = cline.rooIgnoreController?.validateCommand(command)
			if (ignoredFileAttemptedToAccess) {
				await cline.say("rooignore_error", ignoredFileAttemptedToAccess)
				pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(ignoredFileAttemptedToAccess)))
				return
			}

			// Check if the risk level is valid
			if (commandRisk && (!isValidRiskLevel(commandRisk) || commandRisk === "none")) {
				const errorMessage = `Invalid risk level: "${commandRisk}". Valid risk levels are: ${commandRiskLevels.filter((r) => r !== "none").join(", ")}`
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// unescape html entities (e.g. &lt; -> <)
			command = command.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

			cline.consecutiveMistakeCount = 0

			const didApprove = await askApproval("command", command, undefined, metadata)
			if (!didApprove) {
				return
			}

			const [userRejected, result] = await cline.executeCommandTool(command, customCwd)
			if (userRejected) {
				cline.didRejectTool = true
			}
			pushToolResult(result)
			return
		}
	} catch (error) {
		await handleError("executing command", error)
		return
	}
}
