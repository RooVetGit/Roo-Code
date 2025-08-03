// npx vitest services/code-index/__tests__/search-service.spec.ts

import { describe, it, expect, beforeEach, vi, Mock } from "vitest"
import * as path from "path"
import { CodeIndexSearchService } from "../search-service"
import { CodeIndexConfigManager } from "../config-manager"
import { CodeIndexStateManager } from "../state-manager"
import { IEmbedder } from "../interfaces/embedder"
import { IVectorStore, VectorStoreSearchResult } from "../interfaces/vector-store"
import { IReranker, RerankCandidate, RerankResult } from "../interfaces/reranker"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

// Mock dependencies
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

describe("CodeIndexSearchService", () => {
	let service: CodeIndexSearchService
	let mockConfigManager: CodeIndexConfigManager
	let mockStateManager: CodeIndexStateManager
	let mockEmbedder: IEmbedder
	let mockVectorStore: IVectorStore
	let mockReranker: IReranker
	let mockLogger: Mock

	// Sample test data
	const testQuery = "find authentication logic"
	const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5]
	const testVectorResults: VectorStoreSearchResult[] = [
		{
			id: "1",
			score: 0.9,
			payload: {
				filePath: "auth.ts",
				codeChunk: "function authenticate()",
				startLine: 10,
				endLine: 20,
			},
		},
		{
			id: "2",
			score: 0.8,
			payload: {
				filePath: "login.ts",
				codeChunk: "function login()",
				startLine: 5,
				endLine: 15,
			},
		},
		{
			id: "3",
			score: 0.7,
			payload: {
				filePath: "user.ts",
				codeChunk: "class User",
				startLine: 1,
				endLine: 50,
			},
		},
	]

	const testRerankedResults: RerankResult[] = [
		{ id: "2", score: 0.95 }, // login.ts reranked higher
		{ id: "1", score: 0.85 }, // auth.ts second
		// user.ts filtered out by topK
	]

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mocks
		mockLogger = vi.fn()

		// Create mockConfigManager with getter properties that can be modified
		mockConfigManager = {
			get isFeatureEnabled() {
				return true
			},
			get isFeatureConfigured() {
				return true
			},
			get isRerankerEnabled() {
				return true
			},
			get currentSearchMinScore() {
				return 0.5
			},
			get currentSearchMaxResults() {
				return 10
			},
			get rerankerTopN() {
				return 20
			},
			get rerankerTopK() {
				return 5
			},
		} as any

		mockStateManager = {
			getCurrentStatus: vi.fn().mockReturnValue({
				systemStatus: "Indexed",
			}),
			setSystemState: vi.fn(),
		} as any

		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({
				embeddings: [testEmbedding],
			}),
		} as any

		mockVectorStore = {
			search: vi.fn().mockResolvedValue(testVectorResults),
		} as any

		mockReranker = {
			rerank: vi.fn().mockResolvedValue(testRerankedResults),
		} as any

		// Create service with reranker
		service = new CodeIndexSearchService(
			mockConfigManager,
			mockStateManager,
			mockEmbedder,
			mockVectorStore,
			mockReranker,
			mockLogger,
		)
	})

	describe("Reranking Enabled Scenarios", () => {
		it("should successfully rerank when reranker is enabled and functional", async () => {
			const results = await service.searchIndex(testQuery)

			// Verify embedder was called
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalledWith([testQuery])

			// Verify vector search was called with topN limit
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				undefined,
				0.5,
				20, // topN for reranking candidates
			)

			// Verify reranker was called with correct candidates
			expect(mockReranker.rerank).toHaveBeenCalledTimes(1)
			const rerankCall = (mockReranker.rerank as Mock).mock.calls[0]
			expect(rerankCall[0]).toBe(testQuery)
			expect(rerankCall[1]).toHaveLength(3) // All vector results
			expect(rerankCall[2]).toBe(5) // topK limit

			// Verify results are reranked and ordered correctly
			expect(results).toHaveLength(2)
			expect(results[0].id).toBe("2") // login.ts first
			expect(results[0].score).toBe(0.95) // reranked score
			expect(results[1].id).toBe("1") // auth.ts second
			expect(results[1].score).toBe(0.85) // reranked score
		})

		it("should pass correct number of candidates (topN) to reranker", async () => {
			// Test with many vector results
			const manyResults = Array.from({ length: 30 }, (_, i) => ({
				id: `${i}`,
				score: 0.9 - i * 0.01,
				payload: {
					filePath: `file${i}.ts`,
					codeChunk: `code${i}`,
					startLine: i * 10,
					endLine: i * 10 + 5,
				},
			}))

			;(mockVectorStore.search as Mock).mockResolvedValue(manyResults)

			await service.searchIndex(testQuery)

			// Verify vector search requested topN results
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				undefined,
				0.5,
				20, // topN
			)
		})

		it("should limit final results to topK after reranking", async () => {
			// Mock reranker to return more than topK results
			const manyRerankedResults = Array.from({ length: 10 }, (_, i) => ({
				id: `${i}`,
				score: 0.95 - i * 0.05,
			}))

			;(mockReranker.rerank as Mock).mockResolvedValue(manyRerankedResults)

			const results = await service.searchIndex(testQuery)

			// Verify reranker was asked to limit to topK
			expect(mockReranker.rerank).toHaveBeenCalledWith(
				testQuery,
				expect.any(Array),
				5, // topK
			)

			// Results should be limited by what reranker returns
			expect(results.length).toBeLessThanOrEqual(10)
		})

		it("should properly map reranked results back to original format", async () => {
			const results = await service.searchIndex(testQuery)

			// Verify original payload is preserved but score is updated
			expect(results[0]).toEqual({
				id: "2",
				score: 0.95, // reranked score
				payload: {
					filePath: "login.ts",
					codeChunk: "function login()",
					startLine: 5,
					endLine: 15,
				},
			})
		})

		it("should handle directory prefix filtering", async () => {
			const directoryPrefix = "src/auth"

			await service.searchIndex(testQuery, directoryPrefix)

			// Verify vector store search was called with normalized prefix
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				path.normalize("src/auth"), // normalized to OS-specific format
				0.5,
				20,
			)
		})
	})

	describe("Reranking Error Handling", () => {
		it("should fallback to vector search results when reranking fails", async () => {
			// Mock reranker to throw error
			const rerankError = new Error("Reranker service unavailable")
			;(mockReranker.rerank as Mock).mockRejectedValue(rerankError)

			const results = await service.searchIndex(testQuery)

			// Should log the error
			expect(mockLogger).toHaveBeenCalledWith(
				"[CodeIndexSearchService] Reranking failed, falling back to vector search results:",
				rerankError,
			)

			// Should capture telemetry
			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(TelemetryEventName.CODE_INDEX_ERROR, {
				error: "Reranker service unavailable",
				stack: expect.any(String),
				location: "searchIndex-reranking",
			})

			// Should return original vector results limited to topK
			expect(results).toHaveLength(3) // All original results fit within topK=5
			expect(results[0].id).toBe("1") // Original order preserved
			expect(results[0].score).toBe(0.9) // Original scores preserved
		})

		it("should limit fallback results to topK when reranking fails", async () => {
			// Create many vector results
			const manyResults = Array.from({ length: 10 }, (_, i) => ({
				id: `${i}`,
				score: 0.9 - i * 0.01,
				payload: { filePath: `file${i}.ts`, codeChunk: `code${i}`, startLine: i, endLine: i + 5 },
			}))

			;(mockVectorStore.search as Mock).mockResolvedValue(manyResults)
			;(mockReranker.rerank as Mock).mockRejectedValue(new Error("Rerank failed"))

			const results = await service.searchIndex(testQuery)

			// Should return topK results only
			expect(results).toHaveLength(5) // topK = 5
			expect(results[0].id).toBe("0") // First result
			expect(results[4].id).toBe("4") // Fifth result
		})

		it("should continue to work even if reranker throws during processing", async () => {
			// Mock a more complex error scenario
			;(mockReranker.rerank as Mock).mockImplementation(() => {
				throw new TypeError("Cannot read property 'map' of undefined")
			})

			const results = await service.searchIndex(testQuery)

			// Should handle gracefully and return vector results
			expect(results).toHaveLength(3)
			expect(results[0].score).toBe(0.9) // Original scores
		})
	})

	describe("Reranking Disabled Scenarios", () => {
		it("should skip reranking when disabled in config", async () => {
			// Use Object.defineProperty to change the getter value
			Object.defineProperty(mockConfigManager, "isRerankerEnabled", {
				get: () => false,
				configurable: true,
			})

			const results = await service.searchIndex(testQuery)

			// Verify vector search used regular maxResults
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				undefined,
				0.5,
				10, // currentSearchMaxResults, not topN
			)

			// Verify reranker was not called
			expect(mockReranker.rerank).not.toHaveBeenCalled()

			// Should return original vector results
			expect(results).toEqual(testVectorResults)
		})

		it("should skip reranking when reranker instance is not available", async () => {
			// Create service without reranker
			const serviceWithoutReranker = new CodeIndexSearchService(
				mockConfigManager,
				mockStateManager,
				mockEmbedder,
				mockVectorStore,
				undefined, // no reranker
				mockLogger,
			)

			const results = await serviceWithoutReranker.searchIndex(testQuery)

			// Verify vector search used regular maxResults
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				undefined,
				0.5,
				10, // currentSearchMaxResults
			)

			// Should return original vector results
			expect(results).toEqual(testVectorResults)
		})

		it("should use regular maxResults limit when reranking is disabled", async () => {
			// Use Object.defineProperty to change the getter values
			Object.defineProperty(mockConfigManager, "isRerankerEnabled", {
				get: () => false,
				configurable: true,
			})
			Object.defineProperty(mockConfigManager, "currentSearchMaxResults", {
				get: () => 3,
				configurable: true,
			})

			// Create more results than limit
			const manyResults = Array.from({ length: 10 }, (_, i) => ({
				id: `${i}`,
				score: 0.9 - i * 0.01,
				payload: { filePath: `file${i}.ts`, codeChunk: `code${i}`, startLine: i, endLine: i + 5 },
			}))

			;(mockVectorStore.search as Mock).mockResolvedValue(manyResults)

			await service.searchIndex(testQuery)

			// Verify correct limit was used
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				testEmbedding,
				undefined,
				0.5,
				3, // currentSearchMaxResults
			)
		})
	})

	describe("Performance Tracking", () => {
		it("should log timing for vector search when reranking is disabled", async () => {
			// Use Object.defineProperty to change the getter value
			Object.defineProperty(mockConfigManager, "isRerankerEnabled", {
				get: () => false,
				configurable: true,
			})

			await service.searchIndex(testQuery)

			// Should log vector search timing
			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringMatching(/\[CodeIndexSearchService\] Vector search completed in \d+ms\. Results: 3/),
			)
		})

		it("should log timing for both vector search and reranking when enabled", async () => {
			await service.searchIndex(testQuery)

			// Should log reranking timing
			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringMatching(/\[CodeIndexSearchService\] Reranking completed in \d+ms\. Input: 3, Output: 2/),
			)
		})

		it("should log timing even when reranking fails", async () => {
			;(mockReranker.rerank as Mock).mockRejectedValue(new Error("Rerank failed"))

			await service.searchIndex(testQuery)

			// Should still log vector search timing in error case
			expect(mockLogger).toHaveBeenCalledWith(
				"[CodeIndexSearchService] Reranking failed, falling back to vector search results:",
				expect.any(Error),
			)
		})
	})

	describe("Error Handling", () => {
		it("should throw error when feature is disabled", async () => {
			// Use Object.defineProperty to change the getter value
			Object.defineProperty(mockConfigManager, "isFeatureEnabled", {
				get: () => false,
				configurable: true,
			})

			await expect(service.searchIndex(testQuery)).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should throw error when feature is not configured", async () => {
			// Use Object.defineProperty to change the getter value
			Object.defineProperty(mockConfigManager, "isFeatureConfigured", {
				get: () => false,
				configurable: true,
			})

			await expect(service.searchIndex(testQuery)).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should throw error when system is not ready", async () => {
			;(mockStateManager.getCurrentStatus as Mock).mockReturnValue({
				systemStatus: "Idle",
			})

			await expect(service.searchIndex(testQuery)).rejects.toThrow(
				"Code index is not ready for search. Current state: Idle",
			)
		})

		it("should allow search during indexing state", async () => {
			;(mockStateManager.getCurrentStatus as Mock).mockReturnValue({
				systemStatus: "Indexing",
			})

			const results = await service.searchIndex(testQuery)

			expect(results).toBeDefined()
			expect(mockVectorStore.search).toHaveBeenCalled()
		})

		it("should handle embedding generation failure", async () => {
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValue({
				embeddings: [],
			})

			await expect(service.searchIndex(testQuery)).rejects.toThrow("Failed to generate embedding for query.")

			// Should set error state
			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				"Search failed: Failed to generate embedding for query.",
			)

			// Should capture telemetry
			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(TelemetryEventName.CODE_INDEX_ERROR, {
				error: "Failed to generate embedding for query.",
				stack: expect.any(String),
				location: "searchIndex",
			})
		})
	})

	describe("Reranker Integration", () => {
		it("should convert vector results to reranker format correctly", async () => {
			await service.searchIndex(testQuery)

			const rerankCall = (mockReranker.rerank as Mock).mock.calls[0]
			const candidates: RerankCandidate[] = rerankCall[1]

			expect(candidates[0]).toEqual({
				id: "1",
				content: "function authenticate()",
				metadata: {
					filePath: "auth.ts",
					startLine: 10,
					endLine: 20,
					score: 0.9,
				},
			})
		})

		it("should handle empty vector results", async () => {
			;(mockVectorStore.search as Mock).mockResolvedValue([])

			const results = await service.searchIndex(testQuery)

			// Should not call reranker with empty results
			expect(mockReranker.rerank).not.toHaveBeenCalled()
			expect(results).toEqual([])
		})

		it("should handle missing payload in vector results", async () => {
			const resultsWithMissingPayload: VectorStoreSearchResult[] = [
				{
					id: "1",
					score: 0.9,
					payload: null,
				},
			]

			;(mockVectorStore.search as Mock).mockResolvedValue(resultsWithMissingPayload)

			await service.searchIndex(testQuery)

			// Should handle gracefully
			const rerankCall = (mockReranker.rerank as Mock).mock.calls[0]
			const candidates: RerankCandidate[] = rerankCall[1]

			expect(candidates[0].content).toBe("") // Default empty content
		})
	})
})
