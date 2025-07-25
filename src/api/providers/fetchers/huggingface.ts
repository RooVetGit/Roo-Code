import { ModelInfo } from "@roo-code/types"
import { z } from "zod"

export interface HuggingFaceModel {
	_id: string
	id: string
	inferenceProviderMapping: InferenceProviderMapping[]
	trendingScore: number
	config: ModelConfig
	tags: string[]
	pipeline_tag: "text-generation" | "image-text-to-text"
	library_name?: string
}

export interface InferenceProviderMapping {
	provider: string
	providerId: string
	status: "live" | "staging" | "error"
	task: "conversational"
}

export interface ModelConfig {
	architectures: string[]
	model_type: string
	tokenizer_config?: {
		chat_template?: string | Array<{ name: string; template: string }>
		model_max_length?: number
	}
}

interface HuggingFaceApiParams {
	pipeline_tag?: "text-generation" | "image-text-to-text"
	filter: string
	inference_provider: string
	limit: number
	expand: string[]
}

const DEFAULT_PARAMS: HuggingFaceApiParams = {
	filter: "conversational",
	inference_provider: "all",
	limit: 100,
	expand: [
		"inferenceProviderMapping",
		"config",
		"library_name",
		"pipeline_tag",
		"tags",
		"mask_token",
		"trendingScore",
	],
}

const BASE_URL = "https://huggingface.co/api/models"
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

interface CacheEntry {
	data: Record<string, ModelInfo>
	timestamp: number
}

let cache: CacheEntry | null = null

function buildApiUrl(params: HuggingFaceApiParams): string {
	const url = new URL(BASE_URL)

	// Add simple params
	Object.entries(params).forEach(([key, value]) => {
		if (!Array.isArray(value)) {
			url.searchParams.append(key, String(value))
		}
	})

	// Handle array params specially
	params.expand.forEach((item) => {
		url.searchParams.append("expand[]", item)
	})

	return url.toString()
}

const headers: HeadersInit = {
	"Upgrade-Insecure-Requests": "1",
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "none",
	"Sec-Fetch-User": "?1",
	Priority: "u=0, i",
	Pragma: "no-cache",
	"Cache-Control": "no-cache",
}

const requestInit: RequestInit = {
	credentials: "include",
	headers,
	method: "GET",
	mode: "cors",
}

/**
 * Parse a HuggingFace model into ModelInfo format
 */
function parseHuggingFaceModel(model: HuggingFaceModel): ModelInfo {
	// Extract context window from tokenizer config if available
	const contextWindow = model.config.tokenizer_config?.model_max_length || 32768 // Default to 32k

	// Determine if model supports images based on pipeline tag
	const supportsImages = model.pipeline_tag === "image-text-to-text"

	// Create a description from available metadata
	const description = [
		model.config.model_type ? `Type: ${model.config.model_type}` : null,
		model.config.architectures?.length ? `Architecture: ${model.config.architectures[0]}` : null,
		model.library_name ? `Library: ${model.library_name}` : null,
		model.inferenceProviderMapping?.length
			? `Providers: ${model.inferenceProviderMapping.map((p) => p.provider).join(", ")}`
			: null,
	]
		.filter(Boolean)
		.join(", ")

	const modelInfo: ModelInfo = {
		maxTokens: Math.min(contextWindow, 8192), // Conservative default, most models support at least 8k output
		contextWindow,
		supportsImages,
		supportsPromptCache: false, // HuggingFace inference API doesn't support prompt caching
		description,
		// HuggingFace models through their inference API are generally free
		inputPrice: 0,
		outputPrice: 0,
	}

	return modelInfo
}

/**
 * Fetch HuggingFace models and return them in ModelInfo format
 */
export async function getHuggingFaceModels(): Promise<Record<string, ModelInfo>> {
	const now = Date.now()

	// Check cache
	if (cache && now - cache.timestamp < CACHE_DURATION) {
		console.log("Using cached Hugging Face models")
		return cache.data
	}

	const models: Record<string, ModelInfo> = {}

	try {
		console.log("Fetching Hugging Face models from API...")

		// Fetch both text-generation and image-text-to-text models in parallel
		const [textGenResponse, imgTextResponse] = await Promise.allSettled([
			fetch(buildApiUrl({ ...DEFAULT_PARAMS, pipeline_tag: "text-generation" }), requestInit),
			fetch(buildApiUrl({ ...DEFAULT_PARAMS, pipeline_tag: "image-text-to-text" }), requestInit),
		])

		let textGenModels: HuggingFaceModel[] = []
		let imgTextModels: HuggingFaceModel[] = []

		// Process text-generation models
		if (textGenResponse.status === "fulfilled" && textGenResponse.value.ok) {
			textGenModels = await textGenResponse.value.json()
		} else {
			console.error("Failed to fetch text-generation models:", textGenResponse)
		}

		// Process image-text-to-text models
		if (imgTextResponse.status === "fulfilled" && imgTextResponse.value.ok) {
			imgTextModels = await imgTextResponse.value.json()
		} else {
			console.error("Failed to fetch image-text-to-text models:", imgTextResponse)
		}

		// Combine and filter models
		const allModels = [...textGenModels, ...imgTextModels].filter(
			(model) => model.inferenceProviderMapping.length > 0,
		)

		// Convert to ModelInfo format
		for (const model of allModels) {
			models[model.id] = parseHuggingFaceModel(model)
		}

		// Update cache
		cache = {
			data: models,
			timestamp: now,
		}

		console.log(`Fetched ${Object.keys(models).length} Hugging Face models`)
		return models
	} catch (error) {
		console.error("Error fetching Hugging Face models:", error)

		// Return cached data if available
		if (cache) {
			console.log("Using stale cached data due to fetch error")
			return cache.data
		}

		// No cache available, return empty object
		return {}
	}
}
