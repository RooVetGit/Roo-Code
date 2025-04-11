import { Cline } from "../Cline"
import { ToolUse } from "../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import path from "path"
import { regexSearchFiles } from "../../services/ripgrep"

export async function searchFilesTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relDirPath: string | undefined = block.params.path
	const regex: string | undefined = block.params.regex
	const filePattern: string | undefined = block.params.file_pattern
	const maxResults: string | undefined = block.params.max_results
	const sharedMessageProps: ClineSayTool = {
		tool: "searchFiles",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex),
		filePattern: removeClosingTag("file_pattern", filePattern),
		maxResults: removeClosingTag("max_results", maxResults),
	}
	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				...sharedMessageProps,
				content: "",
			} satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relDirPath) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "path"))
				return
			}
			if (!regex) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "regex"))
				return
			}
			const maxResultsNumber = parseInt(maxResults ?? "")
			if (maxResults !== undefined && isNaN(maxResultsNumber)) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateInvalidNumberParamError("search_files", "max_results"))
				return
			}
			cline.consecutiveMistakeCount = 0
			const absolutePath = path.resolve(cline.cwd, relDirPath)
			const results = await regexSearchFiles(
				cline.cwd,
				absolutePath,
				regex,
				filePattern,
				maxResultsNumber,
				cline.rooIgnoreController,
			)
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: results,
			} satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)
			if (!didApprove) {
				return
			}
			pushToolResult(results)
			return
		}
	} catch (error) {
		await handleError("searching files", error)
		return
	}
}
