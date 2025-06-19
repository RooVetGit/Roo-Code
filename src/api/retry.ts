import { Anthropic } from "@anthropic-ai/sdk"
import { ApiStream, ApiStreamError } from "./transform/stream"
import delay from "delay"

const RETRIABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]
const MAX_RETRIES = 5
const INITIAL_DELAY_MS = 2000

// `withRetry` is a decorator that adds retry logic to a method that returns an async generator.
// It will retry the method if it fails with a retriable error.
// It uses exponential backoff with jitter to delay between retries.
export function withRetry<T extends (...args: any[]) => ApiStream>(
	options: {
		maxRetries?: number
		baseDelay?: number
		maxDelay?: number
	} = {},
) {
	const { maxRetries = MAX_RETRIES, baseDelay = INITIAL_DELAY_MS } = options

	return function (
		_target: T,
		_context: ClassMethodDecoratorContext<unknown, T>,
	): (this: unknown, ...args: Parameters<T>) => ApiStream {
		const originalMethod = _target

		return async function* (this: unknown, ...args: Parameters<T>): ApiStream {
			let lastError: Error | undefined
			for (let i = 0; i < maxRetries; i++) {
				try {
					yield* originalMethod.apply(this, args)
					return
				} catch (error: any) {
					lastError = error
					const isRetriable =
						error instanceof Anthropic.APIError &&
						error.status &&
						RETRIABLE_STATUS_CODES.includes(error.status)

					if (!isRetriable) {
						throw error
					}

					const exponentialBackoff = Math.pow(2, i)
					const jitter = Math.random()
					const delayMs = Math.min(
						options.maxDelay || Infinity,
						baseDelay * exponentialBackoff * (1 + jitter),
					)

					await delay(delayMs)
				}
			}

			const error: ApiStreamError = {
				type: "error",
				error: "Retries exhausted",
				message: lastError!.message,
			}

			yield error
		}
	}
}
