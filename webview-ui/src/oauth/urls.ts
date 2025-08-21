import { Package } from "@roo/package"

export function getCallbackUrl(provider: string, uriScheme?: string) {
	return encodeURIComponent(`${uriScheme || "vscode"}://${Package.publisher}.${Package.name}/${provider}`)
}

export function getGlamaAuthUrl(uriScheme?: string) {
	return `https://glama.ai/oauth/authorize?callback_url=${getCallbackUrl("glama", uriScheme)}`
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${getCallbackUrl("openrouter", uriScheme)}`
}

export function getRequestyAuthUrl(uriScheme?: string, baseUrl?: string) {
	const requestyBaseUrl = baseUrl || "https://app.requesty.ai"
	// Remove trailing slash if present and ensure we're using the app subdomain for OAuth
	const cleanBaseUrl = requestyBaseUrl.replace(/\/$/, "")
	// If the base URL contains 'router' or 'api', replace with 'app' for OAuth
	const oauthUrl = cleanBaseUrl.replace(/router\.requesty/, "app.requesty").replace(/api\.requesty/, "app.requesty")
	return `${oauthUrl}/oauth/authorize?callback_url=${getCallbackUrl("requesty", uriScheme)}`
}
