import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as path from "path"
import { CodeIndexSearchService } from "../../../services/code-index/search-service"
import { CodeIndexConfigManager } from "../../../services/code-index/config-manager"
import { CodeIndexStateManager } from "../../../services/code-index/state-manager"
import { IEmbedder } from "../../../services/code-index/interfaces/embedder"
import { IVectorStore, VectorStoreSearchResult } from "../../../services/code-index/interfaces/vector-store"
import { IReranker, RerankCandidate, RerankResult } from "../../../services/code-index/interfaces/reranker"
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

describe("CodeIndexSearchService - Reranking Integration", () => {
	let searchService: CodeIndexSearchService
	let mockConfigManager: any
	let mockStateManager: any
	let mockEmbedder: any
	let mockVectorStore: any
	let mockReranker: any
	let consoleLogSpy: any
	let consoleErrorSpy: any

	// Sample data
	const mockSearchResults: VectorStoreSearchResult[] = [
		{
			id: 1,
			score: 0.7,
			payload: {
				filePath: "/src/file1.ts",
				startLine: 10,
				endLine: 20,
				codeChunk: 'function test1() { return "test1"; }',
			},
		},
		{
			id: 2,
			score: 0.6,
			payload: {
				filePath: "/src/file2.ts",
				startLine: 30,
				endLine: 40,
				codeChunk: 'const value = "test2";',
			},
		},
		{
			id: 3,
			score: 0.5,
			payload: {
				filePath: "/src/file3.ts",
				startLine: 50,
				endLine: 60,
				codeChunk: "class TestClass { constructor() {} }",
			},
		},
	]

	const mockRerankedResults: RerankResult[] = [
		{ id: "2", score: 0.9 }, // Second result becomes first
		{ id: "3", score: 0.8 }, // Third result becomes second
		{ id: "1", score: 0.4 }, // First result becomes third
	]

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock console
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Mock ConfigManager
		mockConfigManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isRerankerEnabled: true,
			currentSearchMinScore: 0.3,
			currentSearchMaxResults: 20,
			rerankerTopN: 100,
			rerankerTopK: 20,
		}

		// Mock StateManager
		mockStateManager = {
			getCurrentStatus: vi.fn().mockReturnValue({
				systemStatus: "Indexed",
			}),
			setSystemState: vi.fn(),
		}

		// Mock Embedder
		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({
				embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			}),
		}

		// Mock VectorStore
		mockVectorStore = {
			search: vi.fn().mockResolvedValue(mockSearchResults),
		}

		// Mock Reranker
		mockReranker = {
			rerank: vi.fn().mockResolvedValue(mockRerankedResults),
			validateConfiguration: vi.fn().mockResolvedValue({ valid: true }),
			healthCheck: vi.fn().mockResolvedValue(true),
		}
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe("Search with reranking enabled", () => {
		beforeEach(() => {
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)
		})

		it("should successfully rerank results when reranking is enabled", async () => {
			const query = "test query"

			const results = await searchService.searchIndex(query)

			// Verify embedder was called
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalledWith([query])

			// Verify vector store was called with topN limit
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				[0.1, 0.2, 0.3, 0.4, 0.5],
				undefined,
				0.3,
				100, // topN for reranking
			)

			// Verify reranker was called with correct candidates
			expect(mockReranker.rerank).toHaveBeenCalledWith(
				query,
				expect.arrayContaining([
					expect.objectContaining({
						id: "1",
						content: 'function test1() { return "test1"; }',
					}),
					expect.objectContaining({
						id: "2",
						content: 'const value = "test2";',
					}),
					expect.objectContaining({
						id: "3",
						content: "class TestClass { constructor() {} }",
					}),
				]),
				20, // topK
			)

			// Verify results are reordered according to reranking
			expect(results).toHaveLength(3)
			expect(results[0].id).toBe(2) // ID 2 is now first
			expect(results[0].score).toBe(0.9) // With new score
			expect(results[1].id).toBe(3)
			expect(results[1].score).toBe(0.8)
			expect(results[2].id).toBe(1)
			expect(results[2].score).toBe(0.4)

			// Verify payload is preserved
			expect(results[0].payload?.filePath).toBe("/src/file2.ts")
			expect(results[1].payload?.filePath).toBe("/src/file3.ts")
			expect(results[2].payload?.filePath).toBe("/src/file1.ts")

			// Verify performance logging
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[CodeIndexSearchService] Reranking completed"),
			)
		})

		it("should fall back to vector results when reranking fails", async () => {
			mockReranker.rerank.mockRejectedValueOnce(new Error("Reranking API error"))

			const results = await searchService.searchIndex("test query")

			// Should return original results limited to topK
			expect(results).toHaveLength(3)
			expect(results[0].id).toBe(1) // Original order
			expect(results[0].score).toBe(0.7) // Original score
			expect(results[1].id).toBe(2)
			expect(results[2].id).toBe(3)

			// Verify error logging (logger uses console.log by default)
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[CodeIndexSearchService] Reranking failed, falling back to vector search results:",
				expect.any(Error),
			)

			// Verify telemetry
			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(
				TelemetryEventName.CODE_INDEX_ERROR,
				expect.objectContaining({
					error: "Reranking API error",
					location: "searchIndex-reranking",
				}),
			)
		})

		it("should respect topK limit when reranking returns more results", async () => {
			// Create many search results
			const manyResults = Array.from({ length: 50 }, (_, i) => ({
				id: i + 1,
				score: 0.9 - i * 0.01,
				payload: {
					filePath: `/src/file${i + 1}.ts`,
					startLine: i * 10,
					endLine: i * 10 + 10,
					codeChunk: `code chunk ${i + 1}`,
				},
			}))
			mockVectorStore.search.mockResolvedValueOnce(manyResults)

			// Mock reranker to return all results
			const manyRerankedResults = manyResults.map((r, i) => ({
				id: r.id.toString(),
				score: 0.99 - i * 0.01,
				rank: i + 1,
			}))
			mockReranker.rerank.mockResolvedValueOnce(manyRerankedResults.slice(0, 20))

			const results = await searchService.searchIndex("test query")

			// Should be limited to topK
			expect(results).toHaveLength(20)
			expect(mockReranker.rerank).toHaveBeenCalledWith("test query", expect.any(Array), 20)
		})

		it("should handle empty vector search results", async () => {
			mockVectorStore.search.mockResolvedValueOnce([])

			const results = await searchService.searchIndex("test query")

			expect(results).toHaveLength(0)
			expect(mockReranker.rerank).not.toHaveBeenCalled()

			// Should log vector search completion, not reranking
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[CodeIndexSearchService] Vector search completed"),
			)
		})

		it("should properly map metadata in reranker candidates", async () => {
			await searchService.searchIndex("test query")

			const candidates = mockReranker.rerank.mock.calls[0][1] as RerankCandidate[]

			expect(candidates[0].metadata).toEqual({
				filePath: "/src/file1.ts",
				startLine: 10,
				endLine: 20,
				score: 0.7,
			})
		})

		it("should handle results with missing payload gracefully", async () => {
			const resultsWithMissingPayload: VectorStoreSearchResult[] = [
				{ id: 1, score: 0.7, payload: undefined },
				{
					id: 2,
					score: 0.6,
					payload: { filePath: "/src/file2.ts", startLine: 30, endLine: 40, codeChunk: "test code" },
				},
			]
			mockVectorStore.search.mockResolvedValueOnce(resultsWithMissingPayload)
			mockReranker.rerank.mockResolvedValueOnce([
				{ id: "2", score: 0.9, rank: 1 },
				{ id: "1", score: 0.8, rank: 2 },
			])

			const results = await searchService.searchIndex("test query")

			const candidates = mockReranker.rerank.mock.calls[0][1] as RerankCandidate[]
			expect(candidates[0].content).toBe("") // Empty string for missing payload
			expect(candidates[1].content).toBe("test code")

			expect(results).toHaveLength(2)
		})

		it("should use directory prefix in vector search", async () => {
			const directoryPrefix = "/src/components"

			await searchService.searchIndex("test query", directoryPrefix)

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array),
				path.normalize(directoryPrefix), // normalized to OS-specific format
				0.3,
				100,
			)
		})
	})

	describe("Search with reranking disabled", () => {
		it("should skip reranking when isRerankerEnabled is false", async () => {
			mockConfigManager.isRerankerEnabled = false
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			const results = await searchService.searchIndex("test query")

			// Should use currentSearchMaxResults instead of topN
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array),
				undefined,
				0.3,
				20, // currentSearchMaxResults
			)

			// Reranker should not be called
			expect(mockReranker.rerank).not.toHaveBeenCalled()

			// Results should be in original order
			expect(results).toEqual(mockSearchResults)

			// Should log vector search completion
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[CodeIndexSearchService] Vector search completed"),
			)
		})

		it("should skip reranking when reranker is not provided", async () => {
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				undefined, // No reranker
			)

			const results = await searchService.searchIndex("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array),
				undefined,
				0.3,
				20, // currentSearchMaxResults
			)
			expect(results).toEqual(mockSearchResults)
		})
	})

	describe("Error handling", () => {
		it("should throw error when feature is disabled", async () => {
			mockConfigManager.isFeatureEnabled = false
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			await expect(searchService.searchIndex("test")).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should throw error when feature is not configured", async () => {
			mockConfigManager.isFeatureConfigured = false
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			await expect(searchService.searchIndex("test")).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should throw error when index is not ready", async () => {
			mockStateManager.getCurrentStatus.mockReturnValue({
				systemStatus: "NotIndexed",
			})
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			await expect(searchService.searchIndex("test")).rejects.toThrow(
				"Code index is not ready for search. Current state: NotIndexed",
			)
		})

		it("should allow search during indexing state", async () => {
			mockStateManager.getCurrentStatus.mockReturnValue({
				systemStatus: "Indexing",
			})
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			const results = await searchService.searchIndex("test query")

			expect(results).toHaveLength(3)
			expect(mockReranker.rerank).toHaveBeenCalled()
		})

		it("should handle embedding generation failure", async () => {
			mockEmbedder.createEmbeddings.mockResolvedValueOnce({
				embeddings: [],
			})
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			await expect(searchService.searchIndex("test")).rejects.toThrow("Failed to generate embedding for query.")

			expect(mockStateManager.setSystemState).toHaveBeenCalledWith(
				"Error",
				"Search failed: Failed to generate embedding for query.",
			)

			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(
				TelemetryEventName.CODE_INDEX_ERROR,
				expect.objectContaining({
					error: "Failed to generate embedding for query.",
					location: "searchIndex",
				}),
			)
		})

		it("should handle vector store search failure", async () => {
			mockVectorStore.search.mockRejectedValueOnce(new Error("Vector store error"))
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)

			await expect(searchService.searchIndex("test")).rejects.toThrow("Vector store error")

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[CodeIndexSearchService] Error during search:",
				expect.any(Error),
			)
		})
	})

	describe("Performance logging", () => {
		beforeEach(() => {
			searchService = new CodeIndexSearchService(
				mockConfigManager as any,
				mockStateManager as any,
				mockEmbedder as any,
				mockVectorStore as any,
				mockReranker as any,
			)
		})

		it("should log performance metrics for successful reranking", async () => {
			// Mock delays to test timing
			mockVectorStore.search.mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50))
				return mockSearchResults
			})
			mockReranker.rerank.mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 30))
				return mockRerankedResults
			})

			await searchService.searchIndex("test query")

			// Check reranking performance log
			const rerankingLog = consoleLogSpy.mock.calls.find((call: any) => call[0]?.includes("Reranking completed"))
			expect(rerankingLog).toBeTruthy()
			expect(rerankingLog[0]).toMatch(/Reranking completed in \d+ms/)
			expect(rerankingLog[0]).toContain("Input: 3, Output: 3")
		})

		it("should log vector search performance when reranking is disabled", async () => {
			mockConfigManager.isRerankerEnabled = false

			await searchService.searchIndex("test query")

			const vectorSearchLog = consoleLogSpy.mock.calls.find((call: any[]) =>
				call[0]?.includes("Vector search completed"),
			)
			expect(vectorSearchLog).toBeTruthy()
			expect(vectorSearchLog[0]).toMatch(/Vector search completed in \d+ms/)
			expect(vectorSearchLog[0]).toContain("Results: 3")
		})
	})
})
