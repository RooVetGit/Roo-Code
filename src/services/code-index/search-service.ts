import * as path from "path"
import { VectorStoreSearchResult } from "./interfaces"
import { IEmbedder } from "./interfaces/embedder"
import { IVectorStore } from "./interfaces/vector-store"
import { IReranker, RerankCandidate } from "./interfaces/reranker"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { LogFunction } from "../../utils/outputChannelLogger"

/**
 * Service responsible for searching the code index.
 */
export class CodeIndexSearchService {
	private readonly logger: LogFunction

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
		private readonly reranker?: IReranker, // Add optional reranker
		logger?: LogFunction,
	) {
		this.logger = logger || ((...args: unknown[]) => console.log(...args))
	}

	/**
	 * Searches the code index for relevant content.
	 * @param query The search query
	 * @param limit Maximum number of results to return
	 * @param directoryPrefix Optional directory path to filter results by
	 * @returns Array of search results
	 * @throws Error if the service is not properly configured or ready
	 */
	public async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.configManager.isFeatureEnabled || !this.configManager.isFeatureConfigured) {
			throw new Error("Code index feature is disabled or not configured.")
		}

		const currentState = this.stateManager.getCurrentStatus().systemStatus
		if (currentState !== "Indexed" && currentState !== "Indexing") {
			// Allow search during Indexing too
			throw new Error(`Code index is not ready for search. Current state: ${currentState}`)
		}

		try {
			// Generate embedding for query
			const embeddingResponse = await this.embedder.createEmbeddings([query])
			const vector = embeddingResponse?.embeddings[0]
			if (!vector) {
				throw new Error("Failed to generate embedding for query.")
			}

			// Handle directory prefix
			let normalizedPrefix: string | undefined = undefined
			if (directoryPrefix) {
				normalizedPrefix = path.normalize(directoryPrefix)
			}

			// Determine if we should use reranking
			const useReranking = this.configManager.isRerankerEnabled && this.reranker

			// Get search parameters
			const minScore = this.configManager.currentSearchMinScore
			const maxResults = useReranking
				? this.configManager.rerankerTopN // Get more candidates for reranking
				: this.configManager.currentSearchMaxResults

			// Perform vector search
			const startTime = Date.now()
			const results = await this.vectorStore.search(vector, normalizedPrefix, minScore, maxResults)
			const vectorSearchTime = Date.now() - startTime

			// Apply reranking if enabled
			if (useReranking && this.reranker && results.length > 0) {
				const rerankStartTime = Date.now()
				try {
					const rerankedResults = await this.applyReranking(query, results)
					const rerankTime = Date.now() - rerankStartTime
					this.logger(
						`[CodeIndexSearchService] Reranking completed in ${rerankTime}ms. Input: ${results.length}, Output: ${rerankedResults.length}`,
					)
					return rerankedResults
				} catch (rerankError) {
					// Log error but don't fail the search
					this.logger(
						"[CodeIndexSearchService] Reranking failed, falling back to vector search results:",
						rerankError,
					)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: (rerankError as Error).message,
						stack: (rerankError as Error).stack,
						location: "searchIndex-reranking",
					})
					// Return original results limited to topK
					return results.slice(0, this.configManager.rerankerTopK)
				}
			}

			this.logger(
				`[CodeIndexSearchService] Vector search completed in ${vectorSearchTime}ms. Results: ${results.length}`,
			)
			return results
		} catch (error) {
			this.logger("[CodeIndexSearchService] Error during search:", error)
			this.stateManager.setSystemState("Error", `Search failed: ${(error as Error).message}`)

			// Capture telemetry for the error
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: (error as Error).message,
				stack: (error as Error).stack,
				location: "searchIndex",
			})

			throw error // Re-throw the error after setting state
		}
	}

	/**
	 * Applies reranking to search results
	 * @param query The original search query
	 * @param results The vector search results to rerank
	 * @returns Reranked and filtered results
	 */
	private async applyReranking(
		query: string,
		results: VectorStoreSearchResult[],
	): Promise<VectorStoreSearchResult[]> {
		// Convert to reranker format
		const candidates: RerankCandidate[] = results.map((r) => ({
			id: r.id.toString(),
			content: r.payload?.codeChunk || "",
			metadata: {
				filePath: r.payload?.filePath,
				startLine: r.payload?.startLine,
				endLine: r.payload?.endLine,
				score: r.score,
			},
		}))

		// Rerank results
		const rerankedResults = await this.reranker!.rerank(query, candidates, this.configManager.rerankerTopK)

		// Map back to original format, preserving payload
		const resultMap = new Map(results.map((r) => [r.id.toString(), r]))

		return rerankedResults.map((reranked) => {
			const original = resultMap.get(reranked.id)!
			return {
				...original,
				score: reranked.score, // Use reranked score
			}
		})
	}
}
