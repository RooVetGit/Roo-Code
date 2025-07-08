/**
 * Fetch wrapper for on-premises deployments
 * Blocks external HTTP calls when ON_PREM environment variable is set to "true"
 */

export function isOnPremMode(): boolean {
	return process.env.ON_PREM === "true"
}

/**
 * Checks if a URL is allowed in ON_PREM mode
 * @param url - The URL to check
 * @returns true if the URL is allowed (local/internal), false if it should be blocked
 */
function isAllowedUrl(url: string | URL): boolean {
	const urlStr = url.toString()

	// Allow relative URLs
	if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
		return true
	}

	try {
		const urlObj = new URL(urlStr)
		const hostname = urlObj.hostname.toLowerCase()

		// Allow localhost and loopback addresses
		if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
			return true
		}

		// Allow internal network hostnames (no dots = internal DNS)
		// This covers cases like "internal-llm", "gpu-srv", etc.
		if (!hostname.includes(".")) {
			return true
		}

		// Allow private IP ranges
		const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
		const ipMatch = hostname.match(ipv4Regex)
		if (ipMatch) {
			const [, a, b, c, d] = ipMatch.map(Number)

			// Private IP ranges:
			// 10.0.0.0/8
			// 172.16.0.0/12
			// 192.168.0.0/16
			if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
				return true
			}
		}

		// Block all other external URLs
		return false
	} catch {
		// If URL parsing fails, allow it (might be relative)
		return true
	}
}

/**
 * Creates a fetch wrapper that blocks external calls in ON_PREM mode
 * @param originalFetch - The original fetch function to wrap
 * @param errorMessage - Custom error message for blocked calls
 * @returns Wrapped fetch function
 */
export function createFetchWrapper(
	originalFetch: typeof fetch = fetch,
	errorMessage: string = "ON_PREM mode: External HTTP calls are disabled",
): typeof fetch {
	return async function wrappedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
		// If not in ON_PREM mode, pass through to original fetch
		if (!isOnPremMode()) {
			return originalFetch(input, init)
		}

		// Extract URL from input
		let url: string | URL
		if (input instanceof Request) {
			url = input.url
		} else {
			url = input
		}

		// Check if URL is allowed
		if (!isAllowedUrl(url)) {
			throw new Error(errorMessage)
		}

		// URL is allowed, proceed with original fetch
		return originalFetch(input, init)
	}
}

/**
 * Global fetch wrapper instance
 * Replace global fetch with this in ON_PREM mode
 */
export const wrappedFetch = createFetchWrapper()

/**
 * Initialize ON_PREM mode by replacing global fetch if needed
 */
export function initializeOnPremMode(): void {
	if (isOnPremMode() && typeof globalThis !== "undefined") {
		// Replace global fetch with wrapped version
		globalThis.fetch = wrappedFetch
		console.info("[ON_PREM] Global fetch replaced with wrapped version - external calls blocked")
	}
}
