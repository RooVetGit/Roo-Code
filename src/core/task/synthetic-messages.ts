import { Anthropic } from "@anthropic-ai/sdk"
import { extractFileMentions, hasFileMentions } from "../mentions/extractFileMentions"
import { processUserContentMentions } from "../mentions/processUserContentMentions"
import { getEnvironmentDetails } from "../environment/getEnvironmentDetails"
import type { Task } from "./Task"

/**
 * Checks if synthetic messages should be used for the given user content.
 * This is true when the message contains @filename mentions.
 */
export function shouldUseSyntheticMessages(userContent: Anthropic.Messages.ContentBlockParam[]): boolean {
	// Only check text blocks for file mentions
	return hasFileMentions(userContent)
}

/**
 * Handles the first message when it contains file mentions by creating synthetic messages.
 * This implements the 3-message pattern:
 * 1. Original user message (without embedded file content)
 * 2. Synthetic assistant message with read_file tool calls
 * 3. User message with file contents
 */
export async function handleFirstMessageWithFileMentions(
	task: Task,
	userContent: Anthropic.Messages.ContentBlockParam[],
): Promise<void> {
	// Extract file mentions from the user content
	const fileMentions: string[] = []
	for (const block of userContent) {
		if (block.type === "text" && block.text) {
			const mentions = extractFileMentions(block.text)
			fileMentions.push(...mentions.map((m) => m.path))
		}
	}

	if (fileMentions.length === 0) {
		// No file mentions found, proceed normally
		return
	}

	// Step 1: Add the original user message to conversation history (without processing mentions)
	await task.addToApiConversationHistory({ role: "user", content: userContent })

	// Step 2: Create synthetic assistant message with read_file tool calls
	const syntheticAssistantContent = createSyntheticReadFileMessage(fileMentions)
	await task.addToApiConversationHistory({
		role: "assistant",
		content: [{ type: "text", text: syntheticAssistantContent }],
	})

	// Step 3: Process the mentions to get file contents and create user response
	const providerState = await task.providerRef.deref()?.getState()
	const {
		showRooIgnoredFiles = true,
		includeDiagnosticMessages = true,
		maxDiagnosticMessages = 50,
	} = providerState ?? {}

	const processedContent = await processUserContentMentions({
		userContent,
		cwd: task.cwd,
		urlContentFetcher: task.urlContentFetcher,
		fileContextTracker: task.fileContextTracker,
		rooIgnoreController: task.rooIgnoreController,
		showRooIgnoredFiles,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
	})

	// Add environment details
	const environmentDetails = await getEnvironmentDetails(task, true)
	const fileContentResponse = [...processedContent, { type: "text" as const, text: environmentDetails }]

	// Add the file content as a user message
	await task.addToApiConversationHistory({ role: "user", content: fileContentResponse })

	// Now continue with the normal flow - the model will see all 3 messages
	// but the task history only stored the original message without embedded content
}

/**
 * Creates a synthetic assistant message with read_file tool calls
 */
export function createSyntheticReadFileMessage(filePaths: string[]): string {
	if (filePaths.length === 0) {
		return ""
	}

	// Group files into batches of 5 (the maximum allowed by read_file tool)
	const MAX_FILES_PER_CALL = 5
	const fileBatches: string[][] = []

	for (let i = 0; i < filePaths.length; i += MAX_FILES_PER_CALL) {
		fileBatches.push(filePaths.slice(i, i + MAX_FILES_PER_CALL))
	}

	// Create read_file tool calls - one per batch
	const toolCalls = fileBatches
		.map((batch) => {
			const fileElements = batch
				.map(
					(path) => `  <file>
    <path>${path}</path>
  </file>`,
				)
				.join("\n")

			return `<read_file>
<args>
${fileElements}
</args>
</read_file>`
		})
		.join("\n\n")

	return `I'll help you with that. Let me first read the mentioned file${filePaths.length > 1 ? "s" : ""} to understand the context.\n\n${toolCalls}`
}
