import Anthropic from "@anthropic-ai/sdk"
import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"

const CONTEXT_FRAC_FOR_SUMMARY = 0.5 // TODO(canyon): make this configurable
const N_MESSAGES_TO_KEEP = 3

const SUMMARY_PROMPT = `\
Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing with the conversation and supporting any continuing tasks.

Your summary should be structure as follows:
Context: The context to continue the conversation with. If applicable based on the current task, this should include:
  1. Previous Conversation: High level details about what was discussed throughout the entire conversation with the user. This should be written to allow someone to be able to follow the general overarching conversation flow.
  2. Current Work: Describe in detail what was being worked on prior to this request to summarize the conversation. Pay special attention to the more recent messages in the conversation.
  3. Key Technical Concepts: List all important technical concepts, technologies, coding conventions, and frameworks discussed, which might be relevant for continuing with this work.
  4. Relevant Files and Code: If applicable, enumerate specific files and code sections examined, modified, or created for the task continuation. Pay special attention to the most recent messages and changes.
  5. Problem Solving: Document problems solved thus far and any ongoing troubleshooting efforts.
  6. Pending Tasks and Next Steps: Outline all pending tasks that you have explicitly been asked to work on, as well as list the next steps you will take for all outstanding work, if applicable. Include code snippets where they add clarity. For any next steps, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no information loss in context between tasks.

Example summary structure:
1. Previous Conversation:
  [Detailed description]
2. Current Work:
  [Detailed description]
3. Key Technical Concepts:
  - [Concept 1]
  - [Concept 2]
  - [...]
4. Relevant Files and Code:
  - [File Name 1]
    - [Summary of why this file is important]
    - [Summary of the changes made to this file, if any]
    - [Important Code Snippet]
  - [File Name 2]
    - [Important Code Snippet]
  - [...]
5. Problem Solving:
  [Detailed description]
6. Pending Tasks and Next Steps:
  - [Task 1 details & next steps]
  - [Task 2 details & next steps]
  - [...]

Output only the summary of the conversation so far, without any additional commentary or explanation.
`

/**
 * Conditionally summarizes the conversation messages if the total token count
 * exceeds a set fraction of the context window.
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {number} totalTokens - The total number of tokens in the conversation, excluding the last user message.
 * @param {number} contextWindow - The context window size.
 * @param {ApiHandler} apiHandler - The API handler to use for token counting.
 * @returns {ApiMessage[]} - The input messages, potentially including a new summary message before the last message.
 */
export async function summarizeConversationIfNeeded(
	messages: ApiMessage[],
	totalTokens: number,
	contextWindow: number,
	apiHandler: ApiHandler,
): Promise<ApiMessage[]> {
	if (totalTokens < contextWindow * CONTEXT_FRAC_FOR_SUMMARY) {
		return messages
	}
	return await summarizeConversation(messages, apiHandler)
}

async function summarizeConversation(messages: ApiMessage[], apiHandler: ApiHandler): Promise<ApiMessage[]> {
	const messagesToSummarize = getMessagesSinceLastSummary(messages.slice(0, -N_MESSAGES_TO_KEEP))
	if (messagesToSummarize.length <= 1) {
		return messages // Not enough messages to warrant a summary
	}
	const keepMessages = messages.slice(-N_MESSAGES_TO_KEEP)
	for (const message of keepMessages) {
		if (message.isSummary) {
			return messages // We recently summarized these messages; it's too soon to summarize again.
		}
	}
	const finalRequestMessage: Anthropic.MessageParam = {
		role: "user",
		content: "Summarize the conversation so far, as described in the prompt instructions.",
	}
	const stream = apiHandler.createMessage(SUMMARY_PROMPT, [...messagesToSummarize, finalRequestMessage])
	let summary = ""
	for await (const chunk of stream) {
		if (chunk.type === "text") {
			summary += chunk.text
		}
	}
	summary = summary.trim()
	if (summary.length === 0) {
		console.warn("Received empty summary from API")
		return messages
	}
	const summaryMessage: ApiMessage = {
		role: "assistant",
		content: summary,
		ts: Date.now(),
		isSummary: true,
	}

	return [...messages.slice(0, -N_MESSAGES_TO_KEEP), summaryMessage, ...keepMessages]
}

/* Returns the list of all messages since the last summary message, including the summary. Returns all messages if there is no summary. */
export function getMessagesSinceLastSummary(messages: ApiMessage[]): ApiMessage[] {
	let lastSummaryIndexReverse = [...messages].reverse().findIndex((message) => message.isSummary)
	if (lastSummaryIndexReverse === -1) {
		return messages
	}
	const lastSummaryIndex = messages.length - lastSummaryIndexReverse - 1
	return messages.slice(lastSummaryIndex)
}
