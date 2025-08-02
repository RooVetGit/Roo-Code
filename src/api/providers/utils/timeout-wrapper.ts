/**
 * Default timeout values in milliseconds
 */
export const DEFAULT_REQUEST_TIMEOUT = 300000 // 5 minutes (current default)

/**
 * Wraps an async iterable to add timeout functionality
 * @param iterable The original async iterable (like OpenAI stream)
 * @param timeout Timeout in milliseconds
 * @returns A new async generator that will throw on timeout
 */
export async function* withTimeout<T>(
	iterable: AsyncIterable<T>,
	timeout: number = DEFAULT_REQUEST_TIMEOUT,
): AsyncGenerator<T> {
	let timeoutId: NodeJS.Timeout | null = null
	let hasTimedOut = false

	const resetTimeout = () => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
		timeoutId = setTimeout(() => {
			hasTimedOut = true
		}, timeout)
	}

	// Set initial timeout
	resetTimeout()

	try {
		for await (const value of iterable) {
			if (hasTimedOut) {
				throw new Error(`Request timeout after ${timeout}ms`)
			}
			// Reset timeout on each chunk received
			resetTimeout()
			yield value
		}
	} catch (error) {
		if (hasTimedOut) {
			throw new Error(`Request timeout after ${timeout}ms`)
		}
		// Check if this is a timeout-related error
		if (error instanceof Error && (error.message.includes("aborted") || error.message.includes("timeout"))) {
			throw new Error(`Request timeout after ${timeout}ms`)
		}
		throw error
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
	}
}

/**
 * Creates an AbortController that will abort after the specified timeout
 * @param timeout Timeout in milliseconds
 * @returns AbortController instance
 */
export function createTimeoutController(timeout: number = DEFAULT_REQUEST_TIMEOUT): AbortController {
	const controller = new AbortController()

	setTimeout(() => {
		controller.abort(new Error(`Request timeout after ${timeout}ms`))
	}, timeout)

	return controller
}

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeout Timeout in milliseconds
 * @returns A promise that will reject on timeout
 */
export async function withTimeoutPromise<T>(
	promise: Promise<T>,
	timeout: number = DEFAULT_REQUEST_TIMEOUT,
): Promise<T> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			reject(new Error(`Request timeout after ${timeout}ms`))
		}, timeout)
	})

	return Promise.race([promise, timeoutPromise])
}
