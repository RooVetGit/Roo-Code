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

export function getRequestyAuthUrl(uriScheme?: string) {
	return `https://app.requesty.ai/oauth/authorize?callback_url=${getCallbackUrl("requesty", uriScheme)}`
}

export function getLiteLLMAuthUrl(baseUrl: string, uriScheme?: string) {
	// Validate URL format to avoid malformed links
	try {
		// Throws on invalid URL
		new URL(baseUrl)
	} catch {
		return ""
	}
	const cleanBaseUrl = baseUrl.replace(/\/+$/, "")
	return `${cleanBaseUrl}/sso/key/generate?response_type=oauth_token&redirect_uri=${getCallbackUrl("litellm", uriScheme)}`
}
