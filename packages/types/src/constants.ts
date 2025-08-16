/**
 * API key environment variable names organized by provider
 */
export const API_KEYS = {
	ANTHROPIC: 'ANTHROPIC_API_KEY',
	OPENAI: 'OPENAI_API_KEY',
	OPEN_ROUTER: 'OPEN_ROUTER_API_KEY',
	GLAMA: 'GLAMA_API_KEY',
	GEMINI: 'GEMINI_API_KEY',
	MISTRAL: 'MISTRAL_API_KEY',
	DEEP_SEEK: 'DEEP_SEEK_API_KEY',
	UNBOUND: 'UNBOUND_API_KEY',
	REQUESTY: 'REQUESTY_API_KEY',
	XAI: 'XAI_API_KEY',
	GROQ: 'GROQ_API_KEY',
	CHUTES: 'CHUTES_API_KEY',
	LITELLM: 'LITELLM_API_KEY',
} as const

/**
 * Array of all API key environment variable names
 */
export const API_KEY_ENV_VAR_NAMES = Object.values(API_KEYS)

/**
 * Type for API key environment variable names
 */
export type ApiKeyEnvVar = typeof API_KEYS[keyof typeof API_KEYS]