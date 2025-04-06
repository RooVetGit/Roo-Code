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
	let limit: number = 10 // Default limit

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

	// --- Approval ---
	const translationKey = "tools:codebaseSearch.approval"
	let approvalMessage: string

	approvalMessage = t(translationKey, { query, limit })

	const didApprove = await askApproval("tool", approvalMessage)
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

		let formattedResult = `Found ${searchResults.length} results for query "${query}":\n\n`
		searchResults.forEach((result, index) => {
			if (!result.payload) return
			if (!("filePath" in result.payload)) return

			// Make file path relative
			const relativePath = vscode.workspace.asRelativePath(result.payload.filePath, false)
			formattedResult += `${index + 1}. File: ${relativePath}\n`
			formattedResult += `   Score: ${result.score.toFixed(4)}\n`
			formattedResult += `   Lines: ${result.payload.startLine}-${result.payload.endLine}\n` // Line numbers from payload
			formattedResult += `   Snippet:\n\`\`\`\n${result.payload.codeChunk.trim()}\n\`\`\`\n\n`
		})

		pushToolResult(formattedResult.trim()) // Use simple string for results
	} catch (error: any) {
		await handleError(toolName, error) // Use the standard error handler
	}
}
