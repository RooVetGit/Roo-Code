import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from "../../api"

/**
 * Default percentage of the context window to use as a buffer when deciding when to truncate
 */
export const TOKEN_BUFFER_PERCENTAGE = 0.1

/**
 * Maximum safe token limit for Claude 3.7 Sonnet (200k - 1k safety buffer)
 * This is imported from constants.ts but redefined here to avoid circular dependencies
 */
export const CLAUDE_MAX_SAFE_TOKEN_LIMIT = 199000

/**
 * Counts tokens for user content using the provider's token counting implementation.
 *
 * @param {Array<Anthropic.Messages.ContentBlockParam>} content - The content to count tokens for
 * @param {ApiHandler} apiHandler - The API handler to use for token counting
 * @returns {Promise<number>} A promise resolving to the token count
 */
export async function estimateTokenCount(
	content: Array<Anthropic.Messages.ContentBlockParam>,
	apiHandler: ApiHandler,
): Promise<number> {
	if (!content || content.length === 0) return 0
	return apiHandler.countTokens(content)
}

/**
 * Truncates a conversation by removing a fraction of the messages.
 *
 * The first message is always retained, and a specified fraction (rounded to an even number)
 * of messages from the beginning (excluding the first) is removed.
 *
 * @param {Anthropic.Messages.MessageParam[]} messages - The conversation messages.
 * @param {number} fracToRemove - The fraction (between 0 and 1) of messages (excluding the first) to remove.
 * @returns {Anthropic.Messages.MessageParam[]} The truncated conversation messages.
 */
export function truncateConversation(
	messages: Anthropic.Messages.MessageParam[],
	fracToRemove: number,
): Anthropic.Messages.MessageParam[] {
	const truncatedMessages = [messages[0]]
	const rawMessagesToRemove = Math.floor((messages.length - 1) * fracToRemove)
	const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2)
	const remainingMessages = messages.slice(messagesToRemove + 1)
	truncatedMessages.push(...remainingMessages)

	return truncatedMessages
}

/**
 * Conditionally truncates the conversation messages if the total token count
 * exceeds the model's limit, considering the size of incoming content.
 *
 * @param {Anthropic.Messages.MessageParam[]} messages - The conversation messages.
 * @param {number} totalTokens - The total number of tokens in the conversation (excluding the last user message).
 * @param {number} contextWindow - The context window size.
 * @param {number} maxTokens - The maximum number of tokens allowed.
 * @param {ApiHandler} apiHandler - The API handler to use for token counting.
 * @returns {Anthropic.Messages.MessageParam[]} The original or truncated conversation messages.
 */

type TruncateOptions = {
	messages: Anthropic.Messages.MessageParam[]
	totalTokens: number
	contextWindow: number
	maxTokens?: number | null
	apiHandler: ApiHandler
}

/**
 * Conditionally truncates the conversation messages if the total token count
 * exceeds the model's limit, considering the size of incoming content.
 *
 * @param {TruncateOptions} options - The options for truncation
 * @returns {Promise<Anthropic.Messages.MessageParam[]>} The original or truncated conversation messages.
 */
export async function truncateConversationIfNeeded({
	messages,
	totalTokens,
	contextWindow,
	maxTokens,
	apiHandler,
}: TruncateOptions): Promise<Anthropic.Messages.MessageParam[]> {
	// Calculate the maximum tokens reserved for response
	const reservedTokens = maxTokens || contextWindow * 0.2

	// Estimate tokens for the last message (which is always a user message)
	const lastMessage = messages[messages.length - 1]
	const lastMessageContent = lastMessage.content
	const lastMessageTokens = Array.isArray(lastMessageContent)
		? await estimateTokenCount(lastMessageContent, apiHandler)
		: await estimateTokenCount([{ type: "text", text: lastMessageContent as string }], apiHandler)

	// Calculate total effective tokens (totalTokens never includes the last message)
	const effectiveTokens = totalTokens + lastMessageTokens

	// Special handling for Anthropic models to ensure we stay under the context window limit
	const { id: modelId, info } = apiHandler.getModel()

	// Check if this is an Anthropic model
	if (modelId.startsWith("claude-")) {
		// Get the context window size for the current model
		const modelContextWindow = info.contextWindow || 200000

		// Calculate a safe token limit (1k tokens below the context window)
		const safeTokenLimit = Math.min(modelContextWindow - 1000, CLAUDE_MAX_SAFE_TOKEN_LIMIT)

		if (effectiveTokens > safeTokenLimit) {
			console.warn(
				`Token count (${effectiveTokens}) exceeds safe limit (${safeTokenLimit}) for model ${modelId}. Using aggressive truncation.`,
			)

			// Calculate how much we need to truncate
			const excessTokens = effectiveTokens - safeTokenLimit

			// Determine truncation fraction based on excess tokens
			// Start with 0.5 (50%) and increase if needed
			let truncationFraction = 0.5

			// If we're significantly over the limit, increase truncation
			if (excessTokens > effectiveTokens * 0.3) {
				truncationFraction = 0.7
			}

			return truncateConversation(messages, truncationFraction)
		}
	}

	// Standard truncation logic for other models
	// Calculate available tokens for conversation history
	// Truncate if we're within TOKEN_BUFFER_PERCENTAGE of the context window
	const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens

	// Determine if truncation is needed and apply if necessary
	return effectiveTokens > allowedTokens ? truncateConversation(messages, 0.5) : messages
}
