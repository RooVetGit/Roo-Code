import * as vscode from "vscode"
import { Cline } from "../Cline"
import { ToolUse } from "../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { CodeIndexManager } from "../../services/code-index/manager"
import { getWorkspacePath } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { QdrantSearchResult } from "../../services/code-index/types"

export async function codebaseSearchTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "codebase_search"
	const workspacePath = getWorkspacePath()

	if (!workspacePath) {
		// This case should ideally not happen if Cline is initialized correctly
		await handleError(toolName, new Error("Could not determine workspace path."))
		return
	}

	// --- Parameter Extraction and Validation ---
	let query: string | undefined = block.params.query
	let limitStr: string | undefined = block.params.limit
	let limit: number = 5 // Default limit

	if (!query) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
		return
	}
	query = removeClosingTag("query", query)

	if (limitStr) {
		limitStr = removeClosingTag("limit", limitStr)
		limit = parseInt(limitStr, 10)
		if (isNaN(limit) || limit <= 0) {
			cline.consecutiveMistakeCount++
			await cline.say("text", `Invalid limit value: "${limitStr}". Using default ${10}.`)
			limit = 10
		}
	}

	// Extract optional sendResultsToUI parameter

	// --- Approval ---
	const translationKey = "chat:codebaseSearch.wantsToSearch"
	let approvalMessage: string

	approvalMessage = t(translationKey, { query, limit })

	const approvalPayload = {
		tool: "codebase_search",
		approvalPrompt: approvalMessage,
		query: query,
		limit: limit,
		isOutsideWorkspace: false,
	}

	const didApprove = await askApproval("tool", JSON.stringify(approvalPayload))
	if (!didApprove) {
		pushToolResult(formatResponse.toolDenied())
		return
	}

	cline.consecutiveMistakeCount = 0

	// --- Core Logic ---
	try {
		const context = cline.providerRef.deref()?.context
		if (!context) {
			throw new Error("Extension context is not available.")
		}

		const manager = CodeIndexManager.getInstance(context)

		// Check if indexing is enabled and configured (using assumed properties/methods)
		// @ts-expect-error Accessing private member _isEnabled
		const isEnabled = manager.isEnabled ?? true // Assume enabled if property doesn't exist
		// @ts-expect-error Accessing private member _isConfigured
		const isConfigured = manager.isConfigured ? manager.isConfigured() : true // Assume configured if method doesn't exist

		if (!isEnabled) {
			throw new Error("Code Indexing is disabled in the settings.")
		}
		if (!isConfigured) {
			throw new Error("Code Indexing is not configured (Missing OpenAI Key or Qdrant URL).")
		}

		const searchResults: QdrantSearchResult[] = await manager.searchIndex(query, limit)

		// 3. Format and push results
		if (!searchResults || searchResults.length === 0) {
			pushToolResult(`No relevant code snippets found for the query: "${query}"`) // Use simple string for no results
			return
		}

		const jsonResult = {
			query,
			results: [],
		} as {
			query: string
			results: Array<{
				filePath: string
				score: number
				startLine: number
				endLine: number
				codeChunk: string
			}>
		}

		searchResults.forEach((result) => {
			if (!result.payload) return
			if (!("filePath" in result.payload)) return

			const relativePath = vscode.workspace.asRelativePath(result.payload.filePath, false)

			jsonResult.results.push({
				filePath: relativePath,
				score: result.score,
				startLine: result.payload.startLine,
				endLine: result.payload.endLine,
				codeChunk: result.payload.codeChunk.trim(),
			})
		})

		// Send results to UI
		const payload = { tool: toolName, content: jsonResult }
		await cline.say("tool", JSON.stringify(payload))

		// Push results to AI
		const xmlResult = `<codebase_search_results>
		<query>${jsonResult.query}</query>
		<results>
		  ${jsonResult.results
				.map(
					(result) => `
		  <result>
		    <filePath>${result.filePath}</filePath>
		    <score>${result.score}</score>
		    <startLine>${result.startLine}</startLine>
		    <endLine>${result.endLine}</endLine>
		    <codeChunk>${result.codeChunk}</codeChunk>
		  </result>
		  `,
				)
				.join("")}
		</results>
</codebase_search_results>`

		pushToolResult(xmlResult)
	} catch (error: any) {
		await handleError(toolName, error) // Use the standard error handler
	}
}
