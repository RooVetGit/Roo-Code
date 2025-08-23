import { vitest, describe, it, expect, beforeEach, afterEach } from "vitest"
import type { MockedClass, MockedFunction } from "vitest"
import { OpenAI } from "openai"
import { OpenAiEmbedder } from "../openai"
import { MAX_BATCH_TOKENS, MAX_ITEM_TOKENS, MAX_BATCH_RETRIES, INITIAL_RETRY_DELAY_MS } from "../../constants"
import { Mutex } from "async-mutex"

// Mock the OpenAI SDK
vitest.mock("openai")

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vitest.fn(),
		},
	},
}))

// Mock i18n
vitest.mock("../../../../i18n", () => ({
	t: (key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"embeddings:authenticationFailed":
				"Failed to create embeddings: Authentication failed. Please check your OpenAI API key.",
			"embeddings:failedWithStatus": `Failed to create embeddings after ${params?.attempts} attempts: HTTP ${params?.statusCode} - ${params?.errorMessage}`,
			"embeddings:failedWithError": `Failed to create embeddings after ${params?.attempts} attempts: ${params?.errorMessage}`,
			"embeddings:failedMaxAttempts": `Failed to create embeddings after ${params?.attempts} attempts`,
			"embeddings:textExceedsTokenLimit": `Text at index ${params?.index} exceeds maximum token limit (${params?.itemTokens} > ${params?.maxTokens}). Skipping.`,
			"embeddings:rateLimitRetry": `Rate limit hit, retrying in ${params?.delayMs}ms (attempt ${params?.attempt}/${params?.maxRetries})`,
		}
		return translations[key] || key
	},
}))

// Mock console methods
const consoleMocks = {
	error: vitest.spyOn(console, "error").mockImplementation(() => {}),
	warn: vitest.spyOn(console, "warn").mockImplementation(() => {}),
}

describe("OpenAiEmbedder", () => {
	let embedder: OpenAiEmbedder
	let mockEmbeddingsCreate: MockedFunction<any>
	let MockedOpenAI: MockedClass<typeof OpenAI>

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()
		consoleMocks.warn.mockClear()

		// Reset global rate limit state
		;(OpenAiEmbedder as any).globalRateLimitState = {
			isRateLimited: false,
			rateLimitResetTime: 0,
			rateLimitHeaders: {},
			mutex: new Mutex(),
		}

		MockedOpenAI = OpenAI as MockedClass<typeof OpenAI>
		mockEmbeddingsCreate = vitest.fn()

		MockedOpenAI.prototype.embeddings = {
			create: mockEmbeddingsCreate,
		} as any

		embedder = new OpenAiEmbedder({
			openAiNativeApiKey: "test-api-key",
			openAiEmbeddingModelId: "text-embedding-3-small",
		})
	})

	afterEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(MockedOpenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" })
			expect(embedder.embedderInfo.name).toBe("openai")
		})

		it("should use 'not-provided' if API key is not provided", () => {
			const embedderWithoutKey = new OpenAiEmbedder({
				openAiEmbeddingModelId: "text-embedding-3-small",
			})

			expect(MockedOpenAI).toHaveBeenCalledWith({ apiKey: "not-provided" })
		})

		it("should use default model if not specified", () => {
			const embedderWithDefaultModel = new OpenAiEmbedder({
				openAiNativeApiKey: "test-api-key",
			})
			// We can't directly test the defaultModelId but it should be text-embedding-3-small
			expect(embedderWithDefaultModel).toBeDefined()
		})
	})

	describe("createEmbeddings", () => {
		const testModelId = "text-embedding-3-small"

		it("should create embeddings for a single text", async () => {
			const testTexts = ["Hello world"]
			const mockResponse = {
				data: {
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { prompt_tokens: 10, total_tokens: 15 },
				},
				response: {
					headers: new Headers(),
				},
			}

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.createEmbeddings(testTexts)

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: testTexts,
				model: testModelId,
			})
			expect(result).toEqual({
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { promptTokens: 10, totalTokens: 15 },
			})
		})

		it("should create embeddings for multiple texts", async () => {
			const testTexts = ["Hello world", "Another text"]
			const mockResponse = {
				data: {
					data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
					usage: { prompt_tokens: 20, total_tokens: 30 },
				},
				response: {
					headers: new Headers(),
				},
			}

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.createEmbeddings(testTexts)

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: testTexts,
				model: testModelId,
			})
			expect(result).toEqual({
				embeddings: [
					[0.1, 0.2, 0.3],
					[0.4, 0.5, 0.6],
				],
				usage: { promptTokens: 20, totalTokens: 30 },
			})
		})

		it("should use custom model when provided", async () => {
			const testTexts = ["Hello world"]
			const customModel = "text-embedding-ada-002"
			const mockResponse = {
				data: {
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { prompt_tokens: 10, total_tokens: 15 },
				},
				response: {
					headers: new Headers(),
				},
			}

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			await embedder.createEmbeddings(testTexts, customModel)

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: testTexts,
				model: customModel,
			})
		})

		it("should handle missing usage data gracefully", async () => {
			const testTexts = ["Hello world"]
			const mockResponse = {
				data: {
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: undefined,
				},
				response: {
					headers: new Headers(),
				},
			}

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.createEmbeddings(testTexts)

			expect(result).toEqual({
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { promptTokens: 0, totalTokens: 0 },
			})
		})

		/**
		 * Test batching logic when texts exceed token limits
		 */
		describe("batching logic", () => {
			it("should process texts in batches", async () => {
				// Use normal sized texts that won't be skipped
				const testTexts = ["text1", "text2", "text3"]

				const mockResponse = {
					data: {
						data: testTexts.map((_, i) => ({ embedding: [i, i + 0.1, i + 0.2] })),
						usage: { prompt_tokens: 30, total_tokens: 45 },
					},
					response: {
						headers: new Headers(),
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				const result = await embedder.createEmbeddings(testTexts)

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
				expect(result.embeddings).toHaveLength(3)
				expect(result.usage?.promptTokens).toBe(30)
			})

			it("should warn and skip texts exceeding maximum token limit", async () => {
				// Create a text that exceeds MAX_ITEM_TOKENS (4 characters ≈ 1 token)
				const oversizedText = "a".repeat(MAX_ITEM_TOKENS * 4 + 100)
				const normalText = "normal text"
				const testTexts = [normalText, oversizedText, "another normal"]

				const mockResponse = {
					data: {
						data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
						usage: { prompt_tokens: 20, total_tokens: 30 },
					},
					response: {
						headers: new Headers(),
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				const result = await embedder.createEmbeddings(testTexts)

				// Verify warning was logged
				expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`exceeds maximum token limit`))

				// Verify only normal texts were processed
				expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
					input: [normalText, "another normal"],
					model: testModelId,
				})
				expect(result.embeddings).toHaveLength(2)
			})

			it("should handle multiple batches when total tokens exceed batch limit", async () => {
				// Create texts that will require multiple batches
				// Each text needs to be less than MAX_ITEM_TOKENS (8191) but together exceed MAX_BATCH_TOKENS (100000)
				// Let's use 8000 tokens per text (safe under MAX_ITEM_TOKENS)
				const tokensPerText = 8000
				const largeText = "a".repeat(tokensPerText * 4) // 4 chars ≈ 1 token
				// Create 15 texts * 8000 tokens = 120000 tokens total
				const testTexts = Array(15).fill(largeText)

				// Mock responses for each batch
				// First batch will have 12 texts (96000 tokens), second batch will have 3 texts (24000 tokens)
				const mockResponse1 = {
					data: {
						data: Array(12)
							.fill(null)
							.map((_, i) => ({ embedding: [i * 0.1, i * 0.1 + 0.1, i * 0.1 + 0.2] })),
						usage: { prompt_tokens: 96000, total_tokens: 96000 },
					},
					response: {
						headers: new Headers(),
					},
				}

				const mockResponse2 = {
					data: {
						data: Array(3)
							.fill(null)
							.map((_, i) => ({
								embedding: [(12 + i) * 0.1, (12 + i) * 0.1 + 0.1, (12 + i) * 0.1 + 0.2],
							})),
						usage: { prompt_tokens: 24000, total_tokens: 24000 },
					},
					response: {
						headers: new Headers(),
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest
					.fn()
					.mockResolvedValueOnce(mockResponse1)
					.mockResolvedValueOnce(mockResponse2)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				const result = await embedder.createEmbeddings(testTexts)

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
				expect(result.embeddings).toHaveLength(15)
				expect(result.usage?.promptTokens).toBe(120000)
				expect(result.usage?.totalTokens).toBe(120000)
			})

			it("should handle all texts being skipped due to size", async () => {
				const oversizedText = "a".repeat(MAX_ITEM_TOKENS * 4 + 100)
				const testTexts = [oversizedText, oversizedText]

				const result = await embedder.createEmbeddings(testTexts)

				expect(console.warn).toHaveBeenCalledTimes(2)
				expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
				expect(result).toEqual({
					embeddings: [],
					usage: { promptTokens: 0, totalTokens: 0 },
				})
			})
		})

		/**
		 * Test retry logic for rate limiting and other errors
		 */
		describe("retry logic", () => {
			beforeEach(() => {
				vitest.useFakeTimers()
			})

			afterEach(() => {
				vitest.useRealTimers()
			})

			it("should retry rate limit errors indefinitely", async () => {
				const testTexts = ["Hello world"]
				const rateLimitError = { status: 429, message: "Rate limit exceeded" }

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn()
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				// Simulate multiple rate limit errors before success
				mockWithResponse
					.mockRejectedValueOnce(rateLimitError)
					.mockRejectedValueOnce(rateLimitError)
					.mockRejectedValueOnce(rateLimitError)
					.mockRejectedValueOnce(rateLimitError)
					.mockResolvedValueOnce({
						data: {
							data: [{ embedding: [0.1, 0.2, 0.3] }],
							usage: { prompt_tokens: 10, total_tokens: 15 },
						},
						response: {
							headers: new Headers(),
						},
					})

				const resultPromise = embedder.createEmbeddings(testTexts)

				// Fast-forward through the delays (4 retries)
				await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS) // First retry delay
				await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS * 2) // Second retry delay
				await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS * 4) // Third retry delay
				await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS * 8) // Fourth retry delay

				const result = await resultPromise

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(5) // 1 initial + 4 retries
				// Should only log once (on first retry) to avoid flooding logs
				expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Rate limit hit, retrying in"))
				expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("attempt 1/∞"))
				expect(result).toEqual({
					embeddings: [[0.1, 0.2, 0.3]],
					usage: { promptTokens: 10, totalTokens: 15 },
				})
			})

			it("should use smart backoff based on rate limit headers", async () => {
				const testTexts = ["Hello world"]
				const rateLimitError = {
					status: 429,
					message: "Rate limit exceeded",
					response: {
						headers: new Headers({
							"x-ratelimit-limit-requests": "60",
							"x-ratelimit-limit-tokens": "150000",
							"x-ratelimit-remaining-requests": "0",
							"x-ratelimit-remaining-tokens": "0",
							"x-ratelimit-reset-requests": "2s",
							"x-ratelimit-reset-tokens": "30s",
						}),
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn()
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				mockWithResponse.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
					data: {
						data: [{ embedding: [0.1, 0.2, 0.3] }],
						usage: { prompt_tokens: 10, total_tokens: 15 },
					},
					response: {
						headers: new Headers(),
					},
				})

				const resultPromise = embedder.createEmbeddings(testTexts)

				// The smart backoff should use 30s (max of 2s and 30s) + 10% buffer = 33s
				await vitest.advanceTimersByTimeAsync(33000)

				const result = await resultPromise

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
				// Should only log once (on first retry) to avoid flooding logs
				expect(console.warn).toHaveBeenCalledTimes(2) // Once for rate limit message, once for rate limits details
				expect(console.warn).toHaveBeenCalledWith(
					expect.stringContaining("Rate limit hit, retrying in 33000ms"),
				)
				expect(console.warn).toHaveBeenCalledWith(
					expect.stringContaining("Rate limits - Requests: 0/60, Tokens: 0/150000"),
				)
				expect(result).toEqual({
					embeddings: [[0.1, 0.2, 0.3]],
					usage: { promptTokens: 10, totalTokens: 15 },
				})
			})

			it("should parse various reset time formats correctly", () => {
				// Test the parseResetTime method directly
				const testCases = [
					{ resetTime: "1s", expectedMs: 1000 },
					{ resetTime: "30s", expectedMs: 30000 },
					{ resetTime: "6m0s", expectedMs: 360000 },
					{ resetTime: "1h30m", expectedMs: 5400000 },
					{ resetTime: "2h", expectedMs: 7200000 },
					{ resetTime: "5m", expectedMs: 300000 },
				]

				// Access the private method for testing
				const embedderAny = embedder as any

				for (const { resetTime, expectedMs } of testCases) {
					const result = embedderAny.parseResetTime(resetTime)
					expect(result).toBe(expectedMs)
				}
			})

			it("should calculate smart backoff correctly", () => {
				// Test the calculateSmartBackoff method directly
				const embedderAny = embedder as any

				// Test with reset headers
				const headers1 = {
					resetRequests: "2s",
					resetTokens: "30s",
				}
				// Should use max (30s) + 10% buffer = 33000ms
				expect(embedderAny.calculateSmartBackoff(headers1, 0)).toBe(33000)

				// Test with only request reset
				const headers2 = {
					resetRequests: "5s",
				}
				// Should use 5s + 10% buffer = 5500ms
				expect(embedderAny.calculateSmartBackoff(headers2, 0)).toBe(5500)

				// Test with no headers (fallback to exponential)
				const headers3 = {}
				// Should use exponential backoff
				expect(embedderAny.calculateSmartBackoff(headers3, 0)).toBe(INITIAL_RETRY_DELAY_MS)
				expect(embedderAny.calculateSmartBackoff(headers3, 1)).toBe(INITIAL_RETRY_DELAY_MS * 2)
				expect(embedderAny.calculateSmartBackoff(headers3, 2)).toBe(INITIAL_RETRY_DELAY_MS * 4)
			})

			it("should not retry on non-rate-limit errors beyond MAX_RETRIES", async () => {
				const testTexts = ["Hello world"]
				const authError = new Error("Unauthorized")
				;(authError as any).status = 401

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn()
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				// Always reject with auth error
				mockWithResponse.mockRejectedValue(authError)

				// Use real timers for this test to avoid unhandled promise rejection issues
				vitest.useRealTimers()

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings: Authentication failed. Please check your OpenAI API key.",
				)

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(MAX_BATCH_RETRIES)
				expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("Rate limit hit"))

				// Re-enable fake timers for other tests
				vitest.useFakeTimers()
			})

			it("should retry non-rate-limit errors up to MAX_RETRIES", async () => {
				const testTexts = ["Hello world"]
				const serverError = new Error("Internal server error")
				;(serverError as any).status = 500

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn()
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				// Fail MAX_BATCH_RETRIES times
				for (let i = 0; i < MAX_BATCH_RETRIES; i++) {
					mockWithResponse.mockRejectedValueOnce(serverError)
				}

				// Use real timers for this test to avoid unhandled promise rejection issues
				vitest.useRealTimers()

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: HTTP 500 - Internal server error",
				)

				expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(MAX_BATCH_RETRIES)
				// Check for the specific error message format
				expect(console.warn).toHaveBeenCalledWith(
					expect.stringContaining("OpenAI embedder error"),
					expect.stringContaining("Internal server error"),
				)

				// Re-enable fake timers for other tests
				vitest.useFakeTimers()
			})
		})

		/**
		 * Test error handling scenarios
		 */
		describe("error handling", () => {
			it("should handle API errors gracefully", async () => {
				const testTexts = ["Hello world"]
				const apiError = new Error("API connection failed")

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(apiError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: API connection failed",
				)

				expect(console.error).toHaveBeenCalledWith(
					expect.stringContaining("OpenAI embedder error"),
					expect.any(Error),
				)
			})

			it("should handle empty text arrays", async () => {
				const testTexts: string[] = []

				const result = await embedder.createEmbeddings(testTexts)

				expect(result).toEqual({
					embeddings: [],
					usage: { promptTokens: 0, totalTokens: 0 },
				})
				expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
			})

			it("should handle malformed API responses", async () => {
				const testTexts = ["Hello world"]
				const malformedResponse = {
					data: {
						data: null,
						usage: { prompt_tokens: 10, total_tokens: 15 },
					},
					response: {
						headers: new Headers(),
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockResolvedValue(malformedResponse)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow()
			})

			it("should provide specific authentication error message", async () => {
				const testTexts = ["Hello world"]
				const authError = new Error("Invalid API key")
				;(authError as any).status = 401

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(authError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings: Authentication failed. Please check your OpenAI API key.",
				)
			})

			it("should provide detailed error message for HTTP errors", async () => {
				const testTexts = ["Hello world"]
				const httpError = new Error("Bad request")
				;(httpError as any).status = 400

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(httpError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: HTTP 400 - Bad request",
				)
			})

			it("should handle errors without status codes", async () => {
				const testTexts = ["Hello world"]
				const networkError = new Error("Network timeout")

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(networkError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: Network timeout",
				)
			})

			it("should handle errors without message property", async () => {
				const testTexts = ["Hello world"]
				const weirdError = { toString: () => "Custom error object" }

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(weirdError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: Custom error object",
				)
			})

			it("should handle completely unknown error types", async () => {
				const testTexts = ["Hello world"]
				const unknownError = null

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(unknownError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: Unknown error",
				)
			})

			it("should handle string errors", async () => {
				const testTexts = ["Hello world"]
				const stringError = "Something went wrong"

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(stringError)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: Something went wrong",
				)
			})

			it("should handle errors with failing toString method", async () => {
				const testTexts = ["Hello world"]
				// When vitest tries to display the error object in test output,
				// it calls toString which throws "toString failed"
				// This happens before our error handling code runs
				const errorWithFailingToString = {
					toString: () => {
						throw new Error("toString failed")
					},
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(errorWithFailingToString)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				// The test framework itself throws "toString failed" when trying to
				// display the error, so we need to expect that specific error
				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow("toString failed")
			})

			it("should handle errors from response.status property", async () => {
				const testTexts = ["Hello world"]
				const errorWithResponseStatus = {
					message: "Request failed",
					response: { status: 403 },
				}

				// Mock withResponse() to return the expected structure
				const mockWithResponse = vitest.fn().mockRejectedValue(errorWithResponseStatus)
				mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

				await expect(embedder.createEmbeddings(testTexts)).rejects.toThrow(
					"Failed to create embeddings after 3 attempts: HTTP 403 - Request failed",
				)
			})
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully with valid configuration", async () => {
			const mockResponse = {
				data: {
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { prompt_tokens: 2, total_tokens: 2 },
				},
				response: {
					headers: new Headers(),
				},
			}

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockResolvedValue(mockResponse)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: ["test"],
				model: "text-embedding-3-small",
			})
		})

		it("should fail validation with authentication error", async () => {
			const authError = new Error("Invalid API key")
			;(authError as any).status = 401

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockRejectedValue(authError)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.authenticationFailed")
		})

		it("should fail validation with rate limit error", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			;(rateLimitError as any).status = 429

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockRejectedValue(rateLimitError)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.serviceUnavailable")
		})

		it("should fail validation with connection error", async () => {
			const connectionError = new Error("ECONNREFUSED")

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockRejectedValue(connectionError)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.connectionFailed")
		})

		it("should fail validation with generic error", async () => {
			const genericError = new Error("Unknown error")
			;(genericError as any).status = 500

			// Mock withResponse() to return the expected structure
			const mockWithResponse = vitest.fn().mockRejectedValue(genericError)
			mockEmbeddingsCreate.mockReturnValue({ withResponse: mockWithResponse })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.configurationError")
		})
	})
})
