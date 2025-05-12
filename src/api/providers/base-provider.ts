import { ApiHandler } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"
import { formatTokenInfo, createTokenTooltip } from "../../utils/tokenDisplay"
import type { ModelInfo, TokenUsageInfo } from "../../shared/api"

// Use any to bypass strict type checking for compatibility
type ContentBlockParam = any
type MessageParam = any

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	abstract createMessage(systemPrompt: string, messages: MessageParam[]): ApiStream
	abstract getModel(): { id: string; info: ModelInfo }

	/**
	 * Gets the last token usage information
	 */
	lastTokenUsage?: TokenUsageInfo

	/**
	 * Default token counting implementation using enhanced tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		// Get the provider ID from the model info
		const { id: providerId } = this.getModel()

		// Use the provider ID to get provider-specific token counting with enhanced accuracy
		return countTokens(content, {
			useWorker: true,
			provider: providerId,
			useEnhanced: true, // Use enhanced tiktoken implementation by default
		})
	}

	/**
	 * Formats token information for display in the UI
	 * @returns Formatted token usage string
	 */
	formatTokenDisplay(): string {
		if (!this.lastTokenUsage) {
			return "No token usage information available"
		}

		const { id: providerId } = this.getModel()
		return formatTokenInfo(this.lastTokenUsage, providerId)
	}

	/**
	 * Creates a detailed tooltip for token usage
	 * @returns Tooltip text with detailed token usage
	 */
	createTokenTooltip(): string {
		if (!this.lastTokenUsage) {
			return "No token usage information available"
		}

		const { id: providerId } = this.getModel()
		return createTokenTooltip(this.lastTokenUsage, providerId)
	}
}
