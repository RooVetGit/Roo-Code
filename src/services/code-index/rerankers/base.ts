import { IReranker, RerankCandidate, RerankResult, RerankerConfig } from "../interfaces/reranker"

/**
 * Abstract base class for reranker implementations
 * Provides common functionality and structure for all rerankers
 */
export abstract class BaseReranker implements IReranker {
	protected readonly provider: string
	protected readonly config: RerankerConfig
	protected readonly logger: Console

	constructor(provider: string, config: RerankerConfig) {
		this.provider = provider
		this.config = config
		this.logger = console
	}

	/**
	 * Reranks search results based on query relevance
	 * @param query The search query
	 * @param results Candidate results to rerank
	 * @param maxResults Maximum number of results to return
	 * @returns Promise resolving to reranked results
	 */
	abstract rerank(query: string, results: RerankCandidate[], maxResults?: number): Promise<RerankResult[]>

	/**
	 * Validates reranker configuration
	 * @returns Promise resolving to validation result
	 */
	abstract validateConfiguration(): Promise<{ valid: boolean; error?: string }>

	/**
	 * Gets reranker health status
	 * @returns Promise resolving to health status
	 */
	abstract healthCheck(): Promise<boolean>

	/**
	 * Common error handler for reranker operations
	 * @param error The error to handle
	 * @param operation The operation that failed
	 * @throws Error with formatted message
	 */
	protected handleError(error: unknown, operation: string): never {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const fullMessage = `${this.provider} reranker ${operation} failed: ${errorMessage}`

		this.logger.error(fullMessage, error)
		throw new Error(fullMessage)
	}

	/**
	 * Validates common configuration requirements
	 * @returns Validation result
	 */
	protected validateCommonConfig(): { valid: boolean; error?: string } {
		if (!this.config.enabled) {
			return { valid: false, error: "Reranker is not enabled" }
		}

		if (this.config.topN <= 0) {
			return { valid: false, error: "topN must be greater than 0" }
		}

		if (this.config.topK <= 0) {
			return { valid: false, error: "topK must be greater than 0" }
		}

		if (this.config.topK > this.config.topN) {
			return { valid: false, error: "topK cannot be greater than topN" }
		}

		return { valid: true }
	}

	/**
	 * Filters and limits results based on configuration
	 * @param results The reranked results
	 * @param maxResults Maximum number of results requested
	 * @returns Filtered results
	 */
	protected filterResults(results: RerankResult[], maxResults?: number): RerankResult[] {
		const limit = maxResults ?? this.config.topK
		return results.slice(0, Math.min(limit, results.length))
	}

	/**
	 * Assigns ranks to results based on scores
	 * @param results Results with scores
	 * @returns Results with assigned ranks
	 */
	protected assignRanks(results: RerankResult[]): RerankResult[] {
		// Sort by score descending
		const sorted = [...results].sort((a, b) => b.score - a.score)

		// Assign ranks
		return sorted.map((result, index) => ({
			...result,
			rank: index + 1,
		}))
	}
}
