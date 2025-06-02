import type { ModelInfo } from "../model.js"

// https://www.modelharbor.com
export const modelHarborBaseURL = "https://api.modelharbor.com"

// VS Code Output Channel interface
interface OutputChannel {
	appendLine(value: string): void
}

// Global logger instance that can be set by VS Code extension
let outputChannel: OutputChannel | null = null

export function setModelHarborOutputChannel(channel: OutputChannel) {
	outputChannel = channel
}

// Logging function with proper VS Code output channel support
function logToChannel(message: string, data?: unknown) {
	try {
		const timestamp = new Date().toISOString()
		const logEntry = `[${timestamp}] ${message}${data ? "\n" + JSON.stringify(data, null, 2) : ""}`

		// Use VS Code output channel if available (extension host environment)
		if (outputChannel && typeof outputChannel.appendLine === "function") {
			outputChannel.appendLine(logEntry)
		}

		// Fallback to console for other environments
		console.log("🔍 ModelHarbor:", message, data)
	} catch (error) {
		console.error("ModelHarbor logging failed:", error)
	}
}

// API response types
interface ModelInfoResponse {
	model_name: string
	litellm_params: {
		merge_reasoning_content_in_choices: boolean
		model: string
		weight?: number
		thinking?: {
			type: string
			budget_tokens: number
		}
	}
	model_info: {
		input_cost_per_token?: number
		output_cost_per_token?: number
		output_cost_per_reasoning_token?: number
		max_input_tokens?: number
		max_output_tokens?: number
		max_tokens?: number
		cache_read_input_token_cost?: number
		input_cost_per_token_batches?: number
		output_cost_per_token_batches?: number
		input_cost_per_token_above_200k_tokens?: number
		output_cost_per_token_above_200k_tokens?: number
		input_cost_per_audio_token?: number
		mode?: string
		supports_system_messages?: boolean
		supports_response_schema?: boolean
		supports_vision?: boolean
		supports_function_calling?: boolean
		supports_tool_choice?: boolean
		supports_assistant_prefill?: boolean
		supports_prompt_caching?: boolean
		supports_audio_input?: boolean
		supports_audio_output?: boolean
		supports_pdf_input?: boolean
		supports_embedding_image_input?: boolean
		supports_native_streaming?: boolean
		supports_web_search?: boolean
		supports_reasoning?: boolean
		supports_computer_use?: boolean
		tpm?: number
		rpm?: number
		supported_openai_params?: string[]
	}
}

interface ApiResponse {
	data: ModelInfoResponse[]
}

// Transform API response to ModelInfo
function transformModelInfo(apiModel: ModelInfoResponse): ModelInfo {
	const { model_info } = apiModel

	// Convert token costs to per-million token costs (multiply by 1,000,000)
	const inputPrice = model_info.input_cost_per_token ? model_info.input_cost_per_token * 1000000 : 0
	const outputPrice = model_info.output_cost_per_token ? model_info.output_cost_per_token * 1000000 : 0
	const cacheReadsPrice = model_info.cache_read_input_token_cost
		? model_info.cache_read_input_token_cost * 1000000
		: 0

	return {
		maxTokens: model_info.max_output_tokens || model_info.max_tokens || 8192,
		contextWindow: model_info.max_input_tokens || 40960,
		supportsImages: model_info.supports_vision || model_info.supports_embedding_image_input || false,
		supportsComputerUse: model_info.supports_computer_use || false,
		supportsPromptCache: model_info.supports_prompt_caching || false,
		supportsReasoningBudget: apiModel.litellm_params.thinking?.type === "enabled" || false,
		requiredReasoningBudget: false,
		supportsReasoningEffort: model_info.supports_reasoning || false,
		inputPrice,
		outputPrice,
		cacheReadsPrice,
		description: `${apiModel.model_name} - ${model_info.mode || "chat"} model with ${model_info.max_input_tokens || "unknown"} input tokens`,
	}
}

// Fetch models from API
async function fetchModelHarborModels(): Promise<Record<string, ModelInfo>> {
	const startTime = Date.now()
	const isWebview = typeof window !== "undefined"

	logToChannel("🚀 Starting ModelHarbor API fetch", {
		url: `${modelHarborBaseURL}/v1/model/info`,
		environment: isWebview ? "browser/webview" : "node/extension-host",
		fetchAvailable: typeof fetch !== "undefined",
		timestamp: new Date().toISOString(),
	})

	// Prevent API calls from webview environment - they should go through message passing
	if (isWebview) {
		logToChannel("🚫 Blocked API call from webview environment - use message passing instead")
		console.log("🚫 ModelHarbor: API calls from webview are blocked to prevent CORS issues")
		console.log("💡 ModelHarbor: Models will be fetched by extension host and communicated via messages")
		return fallbackModelHarborModels
	}

	try {
		// Check if fetch is available (browser/node with fetch polyfill)
		if (typeof fetch === "undefined") {
			logToChannel("❌ fetch is not available")
			throw new Error("fetch is not available")
		}

		logToChannel("✅ fetch is available, making request...")
		console.log("Fetching ModelHarbor models from:", `${modelHarborBaseURL}/v1/model/info`)

		const response = await fetch(`${modelHarborBaseURL}/v1/model/info`, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			// Add these for potential CORS issues
			mode: "cors",
			credentials: "omit",
		})

		logToChannel("📡 Received response", {
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
			headers: Object.fromEntries(response.headers.entries()),
		})

		if (!response.ok) {
			const errorMsg = `Failed to fetch models: ${response.status} ${response.statusText}`
			logToChannel("❌ Response not OK", { error: errorMsg })
			throw new Error(errorMsg)
		}

		logToChannel("📥 Parsing JSON response...")
		const data: ApiResponse = await response.json()

		logToChannel("✅ Successfully parsed response", {
			dataLength: data.data.length,
			sampleModels: data.data.slice(0, 3).map((m) => m.model_name),
		})

		console.log(`Successfully fetched ${data.data.length} model entries from API`)

		const models: Record<string, ModelInfo> = {}
		let processedCount = 0

		for (const apiModel of data.data) {
			// Only process if we haven't seen this model name before (handle duplicates)
			if (!models[apiModel.model_name]) {
				models[apiModel.model_name] = transformModelInfo(apiModel)
				processedCount++
			}
		}

		// Sort model names alphabetically
		const sortedModels: Record<string, ModelInfo> = {}
		const sortedModelNames = Object.keys(models).sort()

		for (const modelName of sortedModelNames) {
			const modelInfo = models[modelName]
			if (modelInfo) {
				sortedModels[modelName] = modelInfo
			}
		}

		const duration = Date.now() - startTime
		logToChannel("🎉 API fetch completed successfully", {
			processedCount,
			totalEntries: data.data.length,
			sortedModelNames: sortedModelNames.slice(0, 5).concat(["..."]),
			durationMs: duration,
		})

		console.log(`Processed ${processedCount} unique models out of ${data.data.length} entries`)
		console.log("Available models (sorted):", sortedModelNames)

		return sortedModels
	} catch (error) {
		const duration = Date.now() - startTime
		const errorDetails = {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			fetchAvailable: typeof fetch !== "undefined",
			environment: isWebview ? "browser/webview" : "node/extension-host",
			url: `${modelHarborBaseURL}/v1/model/info`,
			errorType:
				error instanceof TypeError ? "TypeError (likely CORS/network)" : error?.constructor?.name || "Unknown",
			durationMs: duration,
		}

		logToChannel("💥 API fetch failed, falling back to hardcoded models", errorDetails)

		// Always log the error for debugging, but only in non-test environments
		if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
			console.error("🔴 ModelHarbor API fetch failed - falling back to hardcoded models")
			console.error("Error:", error)
			console.error("Error details:", errorDetails)

			// Check if it's a CORS error
			if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
				console.error(
					"🚨 This appears to be a CORS error - the API call is blocked by browser security policies",
				)
				console.error("💡 This is expected in webview environments. The extension host will handle API calls.")
				logToChannel("🚨 CORS error detected - this is expected in webview environments")
			}
		}
		return fallbackModelHarborModels
	}
}

// Fallback hardcoded models in case API fails (sorted alphabetically)
const fallbackModelHarborModels = {
	"openai/gpt-4.1": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.0002,
		outputPrice: 0.0008,
		description: "OpenAI GPT-4.1 with vision support and advanced function calling capabilities.",
	},
	"qwen/qwen2.5-coder-32b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.3,
		description:
			"Qwen2.5-Coder-32B is a powerful coding-focused model with excellent performance in code generation and understanding.",
	},
	"qwen/qwen3-32b": {
		maxTokens: 8192,
		contextWindow: 40960,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description:
			"Qwen3-32B is a powerful large language model with excellent performance across various tasks including reasoning, coding, and creative writing.",
	},
} as const satisfies Record<string, ModelInfo>

// Cache for fetched models
let cachedModels: Record<string, ModelInfo> | null = null
let fetchPromise: Promise<Record<string, ModelInfo>> | null = null

// Get models (with caching)
export async function getModelHarborModels(forceRefresh = false): Promise<Record<string, ModelInfo>> {
	logToChannel("📋 getModelHarborModels called", {
		forceRefresh,
		hasCachedModels: !!cachedModels,
		cachedModelCount: cachedModels ? Object.keys(cachedModels).length : 0,
		hasFetchPromise: !!fetchPromise,
	})

	if (!forceRefresh && cachedModels) {
		logToChannel("⚡ Returning cached ModelHarbor models", {
			modelCount: Object.keys(cachedModels).length,
			modelNames: Object.keys(cachedModels).slice(0, 5).concat(["..."]),
		})
		console.log("Returning cached ModelHarbor models:", Object.keys(cachedModels).length, "models")
		return cachedModels
	}

	if (!forceRefresh && fetchPromise) {
		logToChannel("⏳ Returning existing fetch promise")
		return fetchPromise
	}

	// Clear cache if forcing refresh
	if (forceRefresh) {
		logToChannel("🗑️ Clearing cache for forced refresh")
		cachedModels = null
		fetchPromise = null
	}

	logToChannel("🎯 Starting new fetch operation")
	fetchPromise = fetchModelHarborModels().then((models) => {
		logToChannel("💾 Caching fetched models", {
			modelCount: Object.keys(models).length,
			modelNames: Object.keys(models).slice(0, 5).concat(["..."]),
		})
		cachedModels = models
		fetchPromise = null
		return models
	})

	return fetchPromise
}

// Clear cache and force refresh
export function clearModelHarborCache(): void {
	cachedModels = null
	fetchPromise = null
	console.log("ModelHarbor cache cleared")
}

// Synchronous access for backward compatibility (uses cached data or fallback)
export const modelHarborModels = new Proxy({} as Record<string, ModelInfo>, {
	get(target, prop: string) {
		if (cachedModels && prop in cachedModels) {
			return cachedModels[prop]
		}
		if (prop in fallbackModelHarborModels) {
			return fallbackModelHarborModels[prop as keyof typeof fallbackModelHarborModels]
		}
		return undefined
	},
	ownKeys() {
		return cachedModels ? Object.keys(cachedModels) : Object.keys(fallbackModelHarborModels)
	},
	has(target, prop: string) {
		return cachedModels ? prop in cachedModels : prop in fallbackModelHarborModels
	},
	getOwnPropertyDescriptor(target, prop: string) {
		const hasProperty = cachedModels ? prop in cachedModels : prop in fallbackModelHarborModels
		if (hasProperty) {
			const value =
				cachedModels?.[prop] || fallbackModelHarborModels[prop as keyof typeof fallbackModelHarborModels]
			return { enumerable: true, configurable: true, value }
		}
		return undefined
	},
})

export type ModelHarborModelId = string

export const modelHarborDefaultModelId: ModelHarborModelId = "qwen/qwen3-32b"

// Initialize models cache on module load only in Node.js environment (extension host)
// In webview/browser environments, models are fetched via message passing
if (typeof window === "undefined") {
	getModelHarborModels().catch(console.error)
}
