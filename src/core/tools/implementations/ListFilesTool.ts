import * as path from "path"
import { Cline } from "../../Cline"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { ToolUse } from "../../assistant-message"
import { formatResponse } from "../../prompts/responses"
import { listFiles } from "../../../services/glob/list-files"
import { getReadablePath } from "../../../utils/path"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../types"
import { BaseTool } from "../BaseTool"

export class ListFilesTool extends BaseTool {
	public getName(): string {
		return "list_files"
	}

	public async execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void> {
		const relDirPath: string | undefined = block.params.path
		const recursiveRaw: string | undefined = block.params.recursive
		const recursive = recursiveRaw?.toLowerCase() === "true"
		const sharedMessageProps: ClineSayTool = {
			tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
			path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
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
					pushToolResult(await cline.sayAndCreateMissingParamError("list_files", "path"))
					return
				}
				cline.consecutiveMistakeCount = 0
				const absolutePath = path.resolve(cline.cwd, relDirPath)
				const [files, didHitLimit] = await listFiles(absolutePath, recursive, 200)
				const { showRooIgnoredFiles = true } = (await cline.providerRef.deref()?.getState()) ?? {}
				const result = formatResponse.formatFilesList(
					absolutePath,
					files,
					didHitLimit,
					cline.rooIgnoreController,
					showRooIgnoredFiles,
				)
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: result,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(result)
			}
		} catch (error) {
			await handleError("listing files", error)
		}
	}
}
