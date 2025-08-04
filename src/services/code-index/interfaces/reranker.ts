/**
 * Reranker provider types
 */
export type RerankerProvider = "local" | "cohere" | "openai" | "custom"

/**
 * Configuration for the reranker
 */
export interface RerankerConfig {
	enabled: boolean
	provider: RerankerProvider
	url?: string
	apiKey?: string
	model?: string
	topN: number
	topK: number
	timeout: number
}

/**
 * Candidate document for reranking
 */
export interface RerankCandidate {
	id: string
	content: string
	metadata?: {
		filePath?: string
		startLine?: number
		endLine?: number
		score?: number
		[key: string]: any
	}
}

/**
 * Result from reranking
 */
export interface RerankResult {
	id: string
	score: number
	originalScore?: number
}

/**
 * Interface for reranking implementations
 */
export interface IReranker {
	/**
	 * Rerank the given candidates based on the query
	 * @param query The search query
	 * @param candidates The candidate documents to rerank
	 * @param maxResults Optional maximum number of results to return
	 * @returns Reranked results with scores
	 */
	rerank(query: string, candidates: RerankCandidate[], maxResults?: number): Promise<RerankResult[]>

	/**
	 * Validates reranker configuration
	 * @returns Promise resolving to validation result
	 */
	validateConfiguration(): Promise<{ valid: boolean; error?: string }>

	/**
	 * Gets reranker health status
	 * @returns Promise resolving to health status
	 */
	healthCheck(): Promise<boolean>
}
