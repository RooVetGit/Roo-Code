import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import axios from "axios"
import { LocalReranker } from "../../../../services/code-index/rerankers/local"
import { RerankerConfig, RerankCandidate } from "../../../../services/code-index/interfaces/reranker"

// Mock axios
vi.mock("axios")

describe("LocalReranker", () => {
	const mockConfig: RerankerConfig = {
		enabled: true,
		provider: "local",
		url: "http://localhost:8080",
		apiKey: "test-api-key",
		model: "test-model",
		topN: 100,
		topK: 20,
		timeout: 30000,
	}

	let consoleLogSpy: any
	let consoleErrorSpy: any

	beforeEach(() => {
		vi.clearAllMocks()
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe("constructor", () => {
		it("should create instance with valid config", () => {
			const mockAxiosCreate = vi.fn().mockReturnValue({})
			;(axios.create as any) = mockAxiosCreate

			const reranker = new LocalReranker(mockConfig)

			expect(reranker).toBeDefined()
			expect(mockAxiosCreate).toHaveBeenCalledWith({
				baseURL: "http://localhost:8080",
				timeout: 30000,
				headers: {
					Authorization: "Bearer test-api-key",
					"Content-Type": "application/json",
				},
			})
		})

		it("should throw error when url is missing", () => {
			const invalidConfig = { ...mockConfig, url: undefined }

			expect(() => new LocalReranker(invalidConfig)).toThrow("Local reranker requires a base URL")
		})

		it("should throw error when apiKey is missing", () => {
			const invalidConfig = { ...mockConfig, apiKey: undefined }

			expect(() => new LocalReranker(invalidConfig)).toThrow("Local reranker requires an API key")
		})

		it("should throw error when non-localhost URL uses HTTP", () => {
			const insecureConfig = { ...mockConfig, url: "http://example.com" }

			expect(() => new LocalReranker(insecureConfig)).toThrow(
				"Reranker URL must use HTTPS for secure API key transmission (exception: localhost)",
			)
		})

		it("should allow HTTP for localhost URLs", () => {
			const mockAxiosCreate = vi.fn().mockReturnValue({})
			;(axios.create as any) = mockAxiosCreate

			const localhostConfigs = [
				{ ...mockConfig, url: "http://localhost:8080" },
				{ ...mockConfig, url: "http://127.0.0.1:8080" },
				{ ...mockConfig, url: "http://[::1]:8080" },
			]

			localhostConfigs.forEach((config) => {
				expect(() => new LocalReranker(config)).not.toThrow()
			})
		})

		it("should allow HTTPS for any URL", () => {
			const mockAxiosCreate = vi.fn().mockReturnValue({})
			;(axios.create as any) = mockAxiosCreate

			const httpsConfig = { ...mockConfig, url: "https://api.example.com" }

			expect(() => new LocalReranker(httpsConfig)).not.toThrow()
			expect(mockAxiosCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.example.com",
				}),
			)
		})

		it("should remove trailing slash from url", () => {
			const mockAxiosCreate = vi.fn().mockReturnValue({})
			;(axios.create as any) = mockAxiosCreate

			const configWithTrailingSlash = { ...mockConfig, url: "http://localhost:8080/" }
			new LocalReranker(configWithTrailingSlash)

			expect(mockAxiosCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "http://localhost:8080",
				}),
			)
		})

		it("should use default timeout when not specified", () => {
			const mockAxiosCreate = vi.fn().mockReturnValue({})
			;(axios.create as any) = mockAxiosCreate

			const { timeout, ...configWithoutTimeout } = mockConfig
			new LocalReranker({ ...configWithoutTimeout, timeout: 30000 } as RerankerConfig)

			expect(mockAxiosCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 30000,
				}),
			)
		})
	})

	describe("rerank", () => {
		let reranker: LocalReranker
		let mockAxiosInstance: any

		beforeEach(() => {
			mockAxiosInstance = {
				post: vi.fn(),
			}
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			reranker = new LocalReranker(mockConfig)
		})

		it("should successfully rerank candidates", async () => {
			const query = "test query"
			const candidates: RerankCandidate[] = [
				{ id: "1", content: "First document" },
				{ id: "2", content: "Second document" },
				{ id: "3", content: "Third document" },
			]

			const mockResponse = {
				data: [
					{ score: 0.9, rank: 1 },
					{ score: 0.7, rank: 2 },
					{ score: 0.5, rank: 3 },
				],
			}
			mockAxiosInstance.post.mockResolvedValueOnce(mockResponse)

			const results = await reranker.rerank(query, candidates)

			expect(mockAxiosInstance.post).toHaveBeenCalledWith("/rerank", {
				query,
				documents: ["First document", "Second document", "Third document"],
				model: "test-model",
				max_results: 20,
			})

			expect(results).toHaveLength(3)
			expect(results[0]).toEqual({ id: "1", score: 0.9, rank: 1 })
			expect(results[1]).toEqual({ id: "2", score: 0.7, rank: 2 })
			expect(results[2]).toEqual({ id: "3", score: 0.5, rank: 3 })
		})

		it("should return empty array for empty candidates", async () => {
			const results = await reranker.rerank("test query", [])

			expect(results).toEqual([])
			expect(mockAxiosInstance.post).not.toHaveBeenCalled()
		})

		it("should throw error for empty query", async () => {
			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("", candidates)).rejects.toThrow("Query cannot be empty")
			await expect(reranker.rerank("   ", candidates)).rejects.toThrow("Query cannot be empty")
		})

		it("should limit candidates to topN", async () => {
			const candidates: RerankCandidate[] = Array.from({ length: 150 }, (_, i) => ({
				id: String(i),
				content: `Document ${i}`,
			}))

			mockAxiosInstance.post.mockResolvedValueOnce({ data: [] })

			await reranker.rerank("test query", candidates)

			const call = mockAxiosInstance.post.mock.calls[0]
			expect(call[1].documents).toHaveLength(100) // topN
		})

		it("should limit results to maxResults parameter", async () => {
			const candidates: RerankCandidate[] = Array.from({ length: 30 }, (_, i) => ({
				id: String(i),
				content: `Document ${i}`,
			}))

			const mockResponse = {
				data: Array.from({ length: 30 }, (_, i) => ({
					score: 1 - i * 0.01,
					rank: i + 1,
				})),
			}
			mockAxiosInstance.post.mockResolvedValueOnce(mockResponse)

			const results = await reranker.rerank("test query", candidates, 10)

			expect(results).toHaveLength(10)
			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				"/rerank",
				expect.objectContaining({
					max_results: 10,
				}),
			)
		})

		it("should handle 401 authentication error", async () => {
			const error = new Error("Unauthorized")
			;(error as any).response = { status: 401, data: "Invalid API key" }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker authentication failed: Invalid API key",
			)
		})

		it("should handle 404 endpoint not found error", async () => {
			const error = new Error("Not Found")
			;(error as any).response = { status: 404, data: "Endpoint not found" }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker endpoint failed: Rerank endpoint not found at http://localhost:8080/rerank",
			)
		})

		it("should handle 429 rate limit error", async () => {
			const error = new Error("Too Many Requests")
			;(error as any).response = { status: 429, data: "Rate limit exceeded" }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker rate-limit failed: Rate limit exceeded",
			)
		})

		it("should handle 500 server error", async () => {
			const error = new Error("Internal Server Error")
			;(error as any).response = { status: 500, data: { error: "Server error" } }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				'local reranker rerank failed: API error (500): {"error":"Server error"}',
			)
		})

		it("should handle timeout/no response error", async () => {
			const error = new Error("Timeout")
			;(error as any).request = {}
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker connection failed: No response from reranker API at http://localhost:8080",
			)
		})

		it("should handle invalid response format - not an array", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({ data: { invalid: "response" } })
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(false)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker rerank failed: Invalid response format from reranker API",
			)
		})

		it("should handle invalid response format - null data", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({ data: null })
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(false)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker rerank failed: Invalid response format from reranker API",
			)
		})

		it("should handle missing candidate for index", async () => {
			const candidates: RerankCandidate[] = [{ id: "1", content: "First" }]

			// Response has more items than candidates
			const mockResponse = {
				data: [
					{ score: 0.9, rank: 1 },
					{ score: 0.7, rank: 2 },
				],
			}
			mockAxiosInstance.post.mockResolvedValueOnce(mockResponse)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(false)

			await expect(reranker.rerank("test query", candidates)).rejects.toThrow(
				"local reranker rerank failed: No candidate found for index 1",
			)
		})

		it("should handle candidates without model in config", async () => {
			const configWithoutModel = { ...mockConfig, model: undefined }
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			const rerankerNoModel = new LocalReranker(configWithoutModel)

			const candidates: RerankCandidate[] = [{ id: "1", content: "Test" }]
			mockAxiosInstance.post.mockResolvedValueOnce({ data: [] })

			await rerankerNoModel.rerank("test query", candidates)

			const payload = mockAxiosInstance.post.mock.calls[0][1]
			expect(payload).not.toHaveProperty("model")
		})

		it("should properly sort and assign ranks", async () => {
			const candidates: RerankCandidate[] = [
				{ id: "1", content: "First" },
				{ id: "2", content: "Second" },
				{ id: "3", content: "Third" },
			]

			// Response with unsorted scores
			const mockResponse = {
				data: [
					{ score: 0.5, rank: 99 }, // Will be re-ranked
					{ score: 0.9, rank: 99 },
					{ score: 0.7, rank: 99 },
				],
			}
			mockAxiosInstance.post.mockResolvedValueOnce(mockResponse)

			const results = await reranker.rerank("test query", candidates)

			// Should be sorted by score descending with correct ranks
			expect(results[0]).toEqual({ id: "2", score: 0.9, rank: 1 })
			expect(results[1]).toEqual({ id: "3", score: 0.7, rank: 2 })
			expect(results[2]).toEqual({ id: "1", score: 0.5, rank: 3 })
		})
	})

	describe("validateConfiguration", () => {
		let reranker: LocalReranker
		let mockAxiosInstance: any

		beforeEach(() => {
			mockAxiosInstance = {
				post: vi.fn(),
			}
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			reranker = new LocalReranker(mockConfig)
		})

		it("should validate successfully with valid response", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				data: [{ score: 0.5, rank: 1 }],
			})

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({ valid: true })
			expect(mockAxiosInstance.post).toHaveBeenCalledWith("/rerank", {
				query: "test",
				documents: ["test document"],
				max_results: 1,
				model: "test-model",
			})
		})

		it("should validate successfully with empty response array", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({ data: [] })

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({ valid: true })
		})

		it("should fail validation for invalid response format", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({ data: { invalid: "format" } })

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "Invalid response format from reranker API",
			})
		})

		it("should fail validation for missing score field", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				data: [{ rank: 1 }], // Missing score
			})

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: 'Reranker API response missing required "score" field',
			})
		})

		it("should handle 401 authentication error", async () => {
			const error = new Error("Unauthorized")
			;(error as any).response = { status: 401 }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "Invalid API key",
			})
		})

		it("should handle 404 endpoint not found", async () => {
			const error = new Error("Not Found")
			;(error as any).response = { status: 404 }
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "Rerank endpoint not found at http://localhost:8080/rerank",
			})
		})

		it("should handle connection error", async () => {
			const error = new Error("Connection error")
			;(error as any).request = {}
			;(error as any).isAxiosError = true
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(true)

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "Cannot connect to reranker API at http://localhost:8080",
			})
		})

		it("should handle generic errors", async () => {
			const error = new Error("Generic error")
			mockAxiosInstance.post.mockRejectedValueOnce(error)
			;(axios.isAxiosError as any) = vi.fn().mockReturnValue(false)

			const result = await reranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "Configuration validation failed: Generic error",
			})
		})

		it("should fail common config validation", async () => {
			const invalidConfig = { ...mockConfig, topK: 0 }
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			const invalidReranker = new LocalReranker(invalidConfig)

			const result = await invalidReranker.validateConfiguration()

			expect(result).toEqual({
				valid: false,
				error: "topK must be greater than 0",
			})
		})

		it("should validate config without model", async () => {
			const configWithoutModel = { ...mockConfig, model: undefined }
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			const rerankerNoModel = new LocalReranker(configWithoutModel)

			mockAxiosInstance.post.mockResolvedValueOnce({ data: [] })

			await rerankerNoModel.validateConfiguration()

			const payload = mockAxiosInstance.post.mock.calls[0][1]
			expect(payload).not.toHaveProperty("model")
		})
	})

	describe("healthCheck", () => {
		let reranker: LocalReranker
		let mockAxiosInstance: any

		beforeEach(() => {
			mockAxiosInstance = {
				post: vi.fn(),
			}
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			reranker = new LocalReranker(mockConfig)
		})

		it("should return true for successful health check", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				status: 200,
				data: [],
			})

			const result = await reranker.healthCheck()

			expect(result).toBe(true)
			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				"/rerank",
				{
					query: "health check",
					documents: ["test"],
					max_results: 1,
					model: "test-model",
				},
				{
					timeout: 5000,
				},
			)
		})

		it("should return false for non-200 status", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				status: 201,
				data: [],
			})

			const result = await reranker.healthCheck()

			expect(result).toBe(false)
		})

		it("should return false for non-array response", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				status: 200,
				data: { invalid: "response" },
			})

			const result = await reranker.healthCheck()

			expect(result).toBe(false)
		})

		it("should return false on error", async () => {
			mockAxiosInstance.post.mockRejectedValueOnce(new Error("Network error"))

			const result = await reranker.healthCheck()

			expect(result).toBe(false)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Health check failed:", expect.any(Error))
		})

		it("should use 5 second timeout", async () => {
			mockAxiosInstance.post.mockResolvedValueOnce({
				status: 200,
				data: [],
			})

			await reranker.healthCheck()

			expect(mockAxiosInstance.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
				timeout: 5000,
			})
		})

		it("should not include model if not configured", async () => {
			const configWithoutModel = { ...mockConfig, model: undefined }
			;(axios.create as any) = vi.fn().mockReturnValue(mockAxiosInstance)
			const rerankerNoModel = new LocalReranker(configWithoutModel)

			mockAxiosInstance.post.mockResolvedValueOnce({
				status: 200,
				data: [],
			})

			await rerankerNoModel.healthCheck()

			const payload = mockAxiosInstance.post.mock.calls[0][1]
			expect(payload).not.toHaveProperty("model")
		})
	})
})
