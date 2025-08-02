import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"
import { CodeIndexConfigManager } from "../../services/code-index/config-manager"
import { CodeIndexServiceFactory } from "../../services/code-index/service-factory"
import { MemoryStorageManager } from "../../services/memory-storage/MemoryStorageManager"
import { CacheManager } from "../../services/code-index/cache-manager"

export async function askMemoryAwareFollowupQuestionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	try {
		if (block.partial) {
			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_memory_aware_followup_question")
				pushToolResult(
					await cline.sayAndCreateMissingParamError("ask_memory_aware_followup_question", "question"),
				)
				return
			}

			type Suggest = { answer: string; mode?: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				// Define the actual structure returned by the XML parser
				type ParsedSuggestion = string | { "#text": string; "@_mode"?: string }

				let parsedSuggest: {
					suggest: ParsedSuggestion[] | ParsedSuggestion
				}

				try {
					parsedSuggest = parseXml(follow_up, ["suggest"]) as {
						suggest: ParsedSuggestion[] | ParsedSuggestion
					}
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("ask_memory_aware_followup_question")
					await cline.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const rawSuggestions = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is ParsedSuggestion => sug !== undefined)

				// Transform parsed XML to our Suggest format
				const normalizedSuggest: Suggest[] = rawSuggestions.map((sug) => {
					if (typeof sug === "string") {
						// Simple string suggestion (no mode attribute)
						return { answer: sug }
					} else {
						// XML object with text content and optional mode attribute
						const result: Suggest = { answer: sug["#text"] }
						if (sug["@_mode"]) {
							result.mode = sug["@_mode"]
						}
						return result
					}
				})

				follow_up_json.suggest = normalizedSuggest
			}

			// Get relevant memories before asking the question
			let memoryContext = ""
			try {
				const provider = cline.providerRef.deref()
				if (provider) {
					const codeIndexManager = provider.codeIndexManager
					if (codeIndexManager) {
						const configManager = new CodeIndexConfigManager(provider.contextProxy)
						const cacheManager = new CacheManager(provider.context, cline.workspacePath)
						const serviceFactory = new CodeIndexServiceFactory(
							configManager,
							cline.workspacePath,
							cacheManager,
						)

						const memoryManager = MemoryStorageManager.getInstance(
							configManager,
							serviceFactory,
							cline.workspacePath,
						)

						if (memoryManager.isEnabled()) {
							const memoryService = await memoryManager.getMemoryStorageService()
							if (memoryService) {
								// Search for relevant memories
								const relevantMemories = await memoryService.searchMemories(question, 5)

								// Format memories for context
								if (relevantMemories.length > 0) {
									memoryContext = "\n\nBased on previous interactions:\n"
									relevantMemories.forEach((memory, index) => {
										memoryContext += `${index + 1}. Q: ${memory.question}\n   A: ${memory.answer}\n`
									})
								}
							}
						}
					}
				}
			} catch (error) {
				console.error("Failed to retrieve memories:", error)
				// Continue without memory context
			}

			// Add memory context to the question
			const questionWithContext = question + memoryContext

			cline.consecutiveMistakeCount = 0
			const { text, images } = await cline.ask(
				"followup",
				JSON.stringify({ ...follow_up_json, question: questionWithContext }),
				false,
			)
			await cline.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			// Store memory if enabled (same as askFollowupQuestionTool)
			try {
				const provider = cline.providerRef.deref()
				if (provider && text) {
					const codeIndexManager = provider.codeIndexManager
					if (codeIndexManager) {
						const configManager = new CodeIndexConfigManager(provider.contextProxy)
						const cacheManager = new CacheManager(provider.context, cline.workspacePath)
						const serviceFactory = new CodeIndexServiceFactory(
							configManager,
							cline.workspacePath,
							cacheManager,
						)

						const memoryManager = MemoryStorageManager.getInstance(
							configManager,
							serviceFactory,
							cline.workspacePath,
						)

						if (memoryManager.isEnabled()) {
							const memoryService = await memoryManager.getMemoryStorageService()
							if (memoryService) {
								await memoryService.storeMemory(
									question,
									text,
									follow_up_json.suggest,
									cline.taskId,
									await cline.getTaskMode(),
								)
							}
						}
					}
				}
			} catch (error) {
				console.error("Failed to store memory:", error)
			}

			return
		}
	} catch (error) {
		await handleError("asking memory-aware question", error)
		return
	}
}
