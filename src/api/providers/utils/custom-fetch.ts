import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici"

/**
 * Creates a custom fetch function with configurable timeout for OpenAI providers.
 * This addresses the issue where undici's default bodyTimeout of 5 minutes
 * causes problems with slow local models during prompt processing.
 *
 * @param timeout - Timeout in milliseconds. If not provided, uses default behavior.
 * @returns A fetch function compatible with the Fetch API
 */
export function createCustomFetch(timeout?: number): typeof fetch {
	if (!timeout) {
		// If no timeout is specified, return the standard fetch
		return fetch
	}

	return function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		// Convert standard fetch parameters to Undici format with extended timeout options
		const undiciOptions: UndiciRequestInit = {
			...init,
			// bodyTimeout controls how long to wait for the response body
			// This is what causes the 5-minute timeout issue with slow models
			bodyTimeout: timeout,
			// headersTimeout controls how long to wait for response headers
			headersTimeout: timeout,
		} as UndiciRequestInit

		// Use undici's fetch with extended timeout options
		// Type assertions handle compatibility between fetch and undici types
		return undiciFetch(input as any, undiciOptions) as any
	}
}

/**
 * Default timeout for OpenAI API requests (30 minutes in milliseconds).
 * This provides a reasonable default for slow local models while still
 * preventing indefinite hangs.
 */
export const DEFAULT_OPENAI_REQUEST_TIMEOUT = 30 * 60 * 1000 // 30 minutes
