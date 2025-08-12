/**
 * Utility functions for parsing Azure OpenAI URLs and extracting API versions
 */

/**
 * Validates if a string is a valid Azure API version format
 * @param version The version string to validate
 * @returns True if the version follows Azure API version format (YYYY-MM-DD or YYYY-MM-DD-preview)
 */
export function isValidAzureApiVersion(version: string): boolean {
	if (!version) return false

	// Azure API versions follow the pattern: YYYY-MM-DD or YYYY-MM-DD-preview
	const versionPattern = /^\d{4}-\d{2}-\d{2}(-preview)?$/
	return versionPattern.test(version)
}

/**
 * Extracts the API version from an Azure OpenAI URL query parameter
 * @param url The Azure OpenAI URL that may contain an api-version query parameter
 * @returns The extracted API version string, or null if not found
 */
export function extractApiVersionFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url)
		const apiVersion = urlObj.searchParams.get("api-version")

		// Validate the extracted version format
		if (apiVersion && !isValidAzureApiVersion(apiVersion)) {
			console.warn(`Invalid Azure API version format: ${apiVersion}`)
		}

		return apiVersion
	} catch (error) {
		// Invalid URL format
		return null
	}
}

/**
 * Checks if a URL appears to be an Azure OpenAI URL
 * @param url The URL to check
 * @returns True if the URL appears to be an Azure OpenAI URL
 */
export function isAzureOpenAiUrl(url: string): boolean {
	try {
		const urlObj = new URL(url)
		const host = urlObj.host.toLowerCase()

		// Exclude Azure AI Inference Service URLs
		if (host.endsWith(".services.ai.azure.com")) {
			return false
		}

		// Check for Azure OpenAI hostname patterns
		// Use endsWith to prevent matching malicious URLs like evil.openai.azure.com.attacker.com
		return (
			host.endsWith(".openai.azure.com") ||
			host === "openai.azure.com" ||
			host.endsWith(".azure.com") ||
			urlObj.pathname.includes("/openai/deployments/")
		)
	} catch (error) {
		return false
	}
}

/**
 * Removes the api-version query parameter from a URL
 * @param url The URL to clean
 * @returns The URL without the api-version parameter
 */
export function removeApiVersionFromUrl(url: string): string {
	try {
		const urlObj = new URL(url)
		urlObj.searchParams.delete("api-version")
		return urlObj.toString()
	} catch (error) {
		// Return original URL if parsing fails
		return url
	}
}
