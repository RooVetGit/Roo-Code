import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { CodeIndexConfigManager } from "../../services/code-index/config-manager"
import { CodeIndexServiceFactory } from "../../services/code-index/service-factory"
import { MemoryStorageManager } from "../../services/memory-storage/MemoryStorageManager"
import { CacheManager } from "../../services/code-index/cache-manager"
import { ClineSayTool } from "../../shared/ExtensionMessage"

export async function searchMemoriesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const query: string | undefined = block.params.query
	const limitStr: string | undefined = block.params.limit
	const limit: number = limitStr ? parseInt(limitStr, 10) : 10

	const sharedMessageProps: ClineSayTool = {
		tool: "codebaseSearch",
		query: removeClosingTag("query", query),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!query) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("search_memories", "query"))
				return
			}

			// Get the provider and check if memory storage is enabled
			const provider = cline.providerRef.deref()
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider not available"))
				return
			}

			const codeIndexManager = provider.codeIndexManager
			if (!codeIndexManager) {
				pushToolResult(formatResponse.toolError("Code index manager not available"))
				return
			}

			// Create necessary managers
			const configManager = new CodeIndexConfigManager(provider.contextProxy)
			const cacheManager = new CacheManager(provider.context, cline.workspacePath)
			const serviceFactory = new CodeIndexServiceFactory(configManager, cline.workspacePath, cacheManager)

			const memoryManager = MemoryStorageManager.getInstance(configManager, serviceFactory, cline.workspacePath)

			if (!memoryManager.isEnabled()) {
				pushToolResult(formatResponse.toolError("Memory storage is not enabled"))
				return
			}

			const memoryService = await memoryManager.getMemoryStorageService()
			if (!memoryService) {
				pushToolResult(formatResponse.toolError("Memory storage service not available"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Search for memories
			const memories = await memoryService.searchMemories(query, limit)

			// Format the results
			let resultText = `Found ${memories.length} relevant memories:\n\n`

			if (memories.length === 0) {
				resultText = "No relevant memories found."
			} else {
				memories.forEach((memory, index) => {
					resultText += `${index + 1}. Question: ${memory.question}\n`
					resultText += `   Answer: ${memory.answer}\n\n`
				})
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: resultText,
			} satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(formatResponse.toolResult(resultText))

			return
		}
	} catch (error) {
		await handleError("searching memories", error)
		return
	}
}
