import axios, { AxiosInstance, AxiosError } from "axios"
import { BaseReranker } from "./base"
import { RerankCandidate, RerankResult, RerankerConfig } from "../interfaces/reranker"

/**
 * Local reranker implementation that communicates with a user's specific reranker API
 */
export class LocalReranker extends BaseReranker {
	private readonly axiosInstance: AxiosInstance
	private readonly baseUrl: string
	private readonly apiKey: string
	private readonly model?: string

	constructor(config: RerankerConfig) {
		super("local", config)

		if (!config.url) {
			throw new Error("Local reranker requires a base URL")
		}

		if (!config.apiKey) {
			throw new Error("Local reranker requires an API key")
		}

		// Validate URL scheme for security
		const url = new URL(config.url)
		const isLocalhost =
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname === "[::1]" || // IPv6 localhost with brackets
			url.hostname === "::1" // IPv6 localhost without brackets

		// Require HTTPS for non-localhost URLs to protect API key transmission
		if (!isLocalhost && url.protocol !== "https:") {
			throw new Error("Reranker URL must use HTTPS for secure API key transmission (exception: localhost)")
		}

		this.baseUrl = config.url.replace(/\/$/, "") // Remove trailing slash
		this.apiKey = config.apiKey
		this.model = config.model

		// Create axios instance with default configuration
		this.axiosInstance = axios.create({
			baseURL: this.baseUrl,
			timeout: config.timeout ?? 30000, // Default 30 seconds
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
		})
	}

	/**
	 * Reranks search results using the local reranker API
	 */
	async rerank(query: string, results: RerankCandidate[], maxResults?: number): Promise<RerankResult[]> {
		try {
			// Validate inputs
			if (!query || query.trim().length === 0) {
				throw new Error("Query cannot be empty")
			}

			if (!results || results.length === 0) {
				return []
			}

			// Limit candidates to topN from config
			const candidatesToRerank = results.slice(0, this.config.topN)

			// Convert RerankCandidate[] to API format
			const documents = candidatesToRerank.map((candidate) => candidate.content)

			// Prepare request payload
			const payload: any = {
				query,
				documents,
			}

			// Add model if specified
			if (this.model) {
				payload.model = this.model
			}

			// Add max_results if specified (using topK as default)
			payload.max_results = maxResults ?? this.config.topK

			this.logger.log(`Reranking ${documents.length} documents for query: "${query}"`)

			// Make the API request
			const response = await this.axiosInstance.post("/rerank", payload)

			// Validate response
			if (!response.data || !Array.isArray(response.data)) {
				throw new Error("Invalid response format from reranker API")
			}

			// Map response back to RerankResult[] format
			const rerankResults: RerankResult[] = response.data.map((item: any, index: number) => {
				// Find the original candidate by matching index
				const originalCandidate = candidatesToRerank[index]

				if (!originalCandidate) {
					throw new Error(`No candidate found for index ${index}`)
				}

				return {
					id: originalCandidate.id,
					score: item.score ?? 0,
					rank: item.rank ?? index + 1,
				}
			})

			// Sort by score descending and assign proper ranks
			const rankedResults = this.assignRanks(rerankResults)

			// Filter results based on maxResults or topK
			return this.filterResults(rankedResults, maxResults)
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError

				if (axiosError.response) {
					// The request was made and the server responded with a status code
					// that falls out of the range of 2xx
					const status = axiosError.response.status
					const data = axiosError.response.data

					if (status === 401) {
						this.handleError(new Error("Invalid API key"), "authentication")
					} else if (status === 404) {
						this.handleError(new Error(`Rerank endpoint not found at ${this.baseUrl}/rerank`), "endpoint")
					} else if (status === 429) {
						this.handleError(new Error("Rate limit exceeded"), "rate-limit")
					} else {
						this.handleError(new Error(`API error (${status}): ${JSON.stringify(data)}`), "rerank")
					}
				} else if (axiosError.request) {
					// The request was made but no response was received
					this.handleError(new Error(`No response from reranker API at ${this.baseUrl}`), "connection")
				} else {
					// Something happened in setting up the request
					this.handleError(error, "request setup")
				}
			}

			this.handleError(error, "rerank")
		}
	}

	/**
	 * Validates the reranker configuration by making a test request
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// First validate common config
			const commonValidation = this.validateCommonConfig()
			if (!commonValidation.valid) {
				return commonValidation
			}

			// Test the rerank endpoint with minimal data
			const testQuery = "test"
			const testDocuments = ["test document"]

			const payload: any = {
				query: testQuery,
				documents: testDocuments,
				max_results: 1,
			}

			if (this.model) {
				payload.model = this.model
			}

			const response = await this.axiosInstance.post("/rerank", payload)

			// Validate response structure
			if (!response.data || !Array.isArray(response.data)) {
				return {
					valid: false,
					error: "Invalid response format from reranker API",
				}
			}

			if (response.data.length > 0) {
				const firstResult = response.data[0]
				if (typeof firstResult.score !== "number") {
					return {
						valid: false,
						error: 'Reranker API response missing required "score" field',
					}
				}
			}

			return { valid: true }
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError

				if (axiosError.response?.status === 401) {
					return { valid: false, error: "Invalid API key" }
				} else if (axiosError.response?.status === 404) {
					return { valid: false, error: `Rerank endpoint not found at ${this.baseUrl}/rerank` }
				} else if (axiosError.request) {
					return { valid: false, error: `Cannot connect to reranker API at ${this.baseUrl}` }
				}
			}

			const errorMessage = error instanceof Error ? error.message : String(error)
			return { valid: false, error: `Configuration validation failed: ${errorMessage}` }
		}
	}

	/**
	 * Performs a health check on the reranker API
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// Try a minimal rerank request
			const payload: any = {
				query: "health check",
				documents: ["test"],
				max_results: 1,
			}

			if (this.model) {
				payload.model = this.model
			}

			const response = await this.axiosInstance.post("/rerank", payload, {
				timeout: 5000, // 5 second timeout for health check
			})

			return response.status === 200 && Array.isArray(response.data)
		} catch (error) {
			this.logger.error("Health check failed:", error)
			return false
		}
	}
}
