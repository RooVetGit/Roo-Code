type CSPDirectives = {
	[key: string]: string[]
}

// Common directives shared between dev and prod. Make changes here when possible
// to avoid duplication and facilitate equivalent testing environments.
const cspBaseDirectives: CSPDirectives = {
	"default-src": ["'none'"],
	"img-src": ["data:"],
	"style-src": ["'unsafe-inline'"],
	"connect-src": ["https://openrouter.ai", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"],
}

// Production-only directives
function cspProdDirectives(webview: { cspSource: string }, nonce: string): CSPDirectives {
	return {
		"default-src": ["'none'"],
		"font-src": [webview.cspSource],
		"style-src": [webview.cspSource, "'unsafe-inline'"],
		"img-src": [webview.cspSource, "data:"],
		"script-src": [`'nonce-${nonce}'`, "https://us-assets.i.posthog.com"],
		"connect-src": ["https://openrouter.ai", "https://us.i.posthog.com", "https://us-assets.i.posthog.com"],
	}
}

// Development-only directives
function cspDevDirectives(webview: { cspSource: string }, nonce: string): CSPDirectives {
	return {
		"default-src": ["'none'"],
		"font-src": [webview.cspSource],
		"style-src": [webview.cspSource, "'unsafe-inline'", "https://*", "http://localhost:*"],
		"img-src": [webview.cspSource, "data:"],
		"script-src": [
			"'unsafe-eval'",
			webview.cspSource,
			"https://*",
			"https://*.posthog.com",
			"http://localhost:*",
			`'nonce-${nonce}'`,
		],
		"connect-src": ["https://*", "https://*.posthog.com", "ws://localhost:*", "http://localhost:*"],
	}
}

/**
 * Generates a Content Security Policy string based on environment and parameters
 */
export function cspGenerate(webview: { cspSource: string }, nonce: string, isDevelopment: boolean): string {
	const directives = isDevelopment ? cspDevDirectives(webview, nonce) : cspProdDirectives(webview, nonce)

	return Object.entries(directives)
		.map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
		.join("; ")
}
