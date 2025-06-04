import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	// constructor remains empty, no new properties added here

	abstract createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	abstract getModel(): { id: string; info: ModelInfo }

	/**
	 * Default token counting implementation using tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		return countTokens(content, { useWorker: true })
	}

	/**
	 * Disposes of any resources held by the provider.
	 * Attempts common disposal methods on the client if it exists.
	 */
	public dispose(): void {
		// Use reflection to find any property named 'client' on the instance
		const clientProperty = (this as any).client
		if (clientProperty) {
			// Try common disposal methods that SDKs might have
			if (typeof clientProperty.close === "function") {
				clientProperty.close()
			} else if (typeof clientProperty.destroy === "function") {
				clientProperty.destroy()
			} else if (typeof clientProperty.dispose === "function") {
				clientProperty.dispose()
			}
			// Clear the reference on the instance
			;(this as any).client = undefined
		}
	}
}
