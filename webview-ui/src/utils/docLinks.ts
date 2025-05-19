/**
 * Utility for building Apex documentation links with UTM telemetry.
 *
 * @param path - The path after the docs root (no leading slash)
 * @param _campaign - The UTM campaign context (e.g. "welcome", "provider_docs", "tips", "error_tooltip")
 * @returns The full docs URL with UTM parameters
 */
export function buildDocLink(path: string, _campaign: string): string {
	// Remove any leading slash from path
	const cleanPath = path.replace(/^\//, "")
	const [hash] = cleanPath.split("#")
	const baseUrl = `https://opensourceful.com`
	return hash ? `${baseUrl}#${hash}` : baseUrl
}
