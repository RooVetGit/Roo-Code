export interface HuggingFaceModel {
	id: string
	object: "model"
	created: number
	owned_by: string
	providers: Provider[]
}

export interface Provider {
	provider: string
	status: "live" | "staging" | "error"
	supports_tools?: boolean
	supports_structured_output?: boolean
	context_length?: number
	pricing?: {
		input: number
		output: number
	}
}

interface HuggingFaceApiResponse {
	object: string
	data: HuggingFaceModel[]
}

const BASE_URL = "https://router.huggingface.co/v1/models?collection=roocode"
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

interface CacheEntry {
	data: HuggingFaceModel[]
	timestamp: number
	status: "success" | "partial" | "error"
}

let cache: CacheEntry | null = null

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

export async function fetchHuggingFaceModels(): Promise<HuggingFaceModel[]> {
	const now = Date.now()

	// Check cache
	if (cache && now - cache.timestamp < CACHE_DURATION) {
		console.log("Using cached Hugging Face models")
		return cache.data
	}

	try {
		console.log("Fetching Hugging Face models from API...")

		const response = await fetch(BASE_URL, requestInit)

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const apiResponse: HuggingFaceApiResponse = await response.json()
		const allModels = apiResponse.data
			.filter((model) => model.providers.length > 0)
			.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()))

		// Update cache
		cache = {
			data: allModels,
			timestamp: now,
			status: "success",
		}

		console.log(`Fetched ${allModels.length} Hugging Face models`)
		return allModels
	} catch (error) {
		console.error("Error fetching Hugging Face models:", error)

		// Return cached data if available
		if (cache) {
			console.log("Using stale cached data due to fetch error")
			cache.status = "error"
			return cache.data
		}

		// No cache available, return empty array
		return []
	}
}

export function getCachedModels(): HuggingFaceModel[] | null {
	return cache?.data || null
}

export function clearCache(): void {
	cache = null
}
