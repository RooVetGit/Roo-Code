import { Anthropic } from "@anthropic-ai/sdk"

import { ModelInfo } from "../../shared/api"
import { workerManager } from "../../services/workers/WorkerManager"

import { ApiHandler } from "../index"
import { ApiStream } from "../transform/stream"

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	abstract createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream
	abstract getModel(): { id: string; info: ModelInfo }

	/**
	 * Default token counting implementation using tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		if (!content || content.length === 0) {
			return 0
		}

		const worker = await workerManager.initializeWorker("token-counter", "workers/token-counter.worker.js")

		return new Promise((resolve, reject) => {
			const messageHandler = (result: number | { error: string }) => {
				worker.removeListener("message", messageHandler)
				worker.removeListener("error", errorHandler)

				if (typeof result === "number") {
					resolve(result)
				} else {
					reject(new Error(result.error))
				}
			}

			const errorHandler = (error: Error) => {
				worker.removeListener("message", messageHandler)
				worker.removeListener("error", errorHandler)
				reject(error)
			}

			worker.once("message", messageHandler)
			worker.once("error", errorHandler)

			worker.postMessage(content)
		})
	}
}
