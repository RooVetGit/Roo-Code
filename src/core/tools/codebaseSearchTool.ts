import * as vscode from "vscode"

import { Task } from "../task/Task"
import { CodeIndexManager } from "../../services/code-index/manager"
import { getWorkspacePath } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { VectorStoreSearchResult } from "../../services/code-index/interfaces"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import path from "path"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

/**
 * Get a user-friendly message for the current indexing state
 * @param state The current indexing state
 * @returns A descriptive message for the user
 */
function getIndexingStateMessage(state: IndexingState): string {
	switch (state) {
		case "Standby":
			return "Code indexing has not started yet. Please wait for the initial indexing to complete."
		case "Indexing":
			return "Code indexing is currently in progress. Semantic search will be available once indexing is complete."
		case "Error":
			return "Code indexing encountered an error. Please check your configuration and try again."
		default:
			return `Code indexing is in an unexpected state: ${state}`
	}
}

export async function codebaseSearchTool(
	cline: Task,
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
	let directoryPrefix: string | undefined = block.params.path

	query = removeClosingTag("query", query)

	if (directoryPrefix) {
		directoryPrefix = removeClosingTag("path", directoryPrefix)
		directoryPrefix = path.normalize(directoryPrefix)
	}

	const sharedMessageProps = {
		tool: "codebaseSearch",
		query: query,
		path: directoryPrefix,
		isOutsideWorkspace: false,
	}

	if (block.partial) {
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	if (!query) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
		return
	}

	const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
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

		if (!manager) {
			throw new Error("CodeIndexManager is not available.")
		}

		if (!manager.isFeatureEnabled) {
			throw new Error("Code Indexing is disabled in the settings.")
		}
		if (!manager.isFeatureConfigured) {
			throw new Error("Code Indexing is not configured (Missing OpenAI Key or Qdrant URL).")
		}

		// Check indexing state at runtime
		const indexingState = manager.state as IndexingState

		// Track telemetry for non-indexed states
		if (indexingState !== "Indexed") {
			TelemetryService.instance.captureEvent(TelemetryEventName.TOOL_USED, {
				tool: toolName,
				codeIndexState: indexingState,
				hasQuery: query ? true : false,
				result: "unavailable_not_indexed",
			})
		}

		if (indexingState !== "Indexed") {
			const stateMessage = getIndexingStateMessage(indexingState)

			// Return informative message instead of throwing error
			pushToolResult(
				`Semantic search is not available yet (currently ${indexingState}).\n\n${stateMessage}\n\nPlease use file reading tools (read_file, search_files) for now.`,
			)
			return
		}

		const searchResults: VectorStoreSearchResult[] = await manager.searchIndex(query, directoryPrefix)

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
		const payload = { tool: "codebaseSearch", content: jsonResult }
		await cline.say("codebase_search_result", JSON.stringify(payload))

		// Push results to AI
		const output = `Query: ${query}
Results:

${jsonResult.results
	.map(
		(result) => `File path: ${result.filePath}
Score: ${result.score}
Lines: ${result.startLine}-${result.endLine}
Code Chunk: ${result.codeChunk}
`,
	)
	.join("\n")}`

		pushToolResult(output)
	} catch (error: any) {
		await handleError(toolName, error) // Use the standard error handler
	}
}
