import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { OpenAICompatibleEmbedder } from "../openai-compatible"
import * as vscode from "vscode"

// Mock fetch globally
global.fetch = vi.fn()

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
			show: vi.fn(),
		})),
	},
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: (key: string, params?: any) => key,
}))

// Mock OpenAI SDK
const mockOpenAICreate = vi.fn()
vi.mock("openai", () => ({
	OpenAI: vi.fn().mockImplementation(() => ({
		embeddings: {
			create: mockOpenAICreate,
		},
	})),
}))

describe("OpenAICompatibleEmbedder - Float Encoding", () => {
	let embedder: OpenAICompatibleEmbedder
	let mockOutputChannel: any
	const baseUrl = "https://api.example.com/v1"
	const apiKey = "test-api-key"
	const modelId = "test-model"

	beforeEach(() => {
		vi.clearAllMocks()
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
			show: vi.fn(),
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Float encoding mode", () => {
		it("should request float encoding when useFloatEncoding is true", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				true, // useFloatEncoding
				mockOutputChannel,
			)

			const mockResponse = {
				data: [
					{
						embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // Raw float array
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			const result = await embedder.createEmbeddings(["test text"])

			// Assert
			expect(mockOpenAICreate).toHaveBeenCalledWith({
				input: ["test text"],
				model: modelId,
				encoding_format: "float", // Should request float format
			})

			// Verify the embeddings are processed correctly
			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3, 0.4, 0.5]])
		})

		it("should request base64 encoding when useFloatEncoding is false", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				false, // useFloatEncoding
				mockOutputChannel,
			)

			// Create a base64 encoded float array
			const floatArray = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
			const buffer = Buffer.from(floatArray.buffer)
			const base64String = buffer.toString("base64")

			const mockResponse = {
				data: [
					{
						embedding: base64String, // Base64 encoded string
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			const result = await embedder.createEmbeddings(["test text"])

			// Assert
			expect(mockOpenAICreate).toHaveBeenCalledWith({
				input: ["test text"],
				model: modelId,
				encoding_format: "base64", // Should request base64 format
			})

			// Verify the embeddings are decoded correctly
			expect(result.embeddings[0]).toHaveLength(5)
			expect(result.embeddings[0][0]).toBeCloseTo(0.1, 5)
			expect(result.embeddings[0][1]).toBeCloseTo(0.2, 5)
			expect(result.embeddings[0][2]).toBeCloseTo(0.3, 5)
			expect(result.embeddings[0][3]).toBeCloseTo(0.4, 5)
			expect(result.embeddings[0][4]).toBeCloseTo(0.5, 5)
		})

		it("should handle multiple embeddings with float encoding", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				true, // useFloatEncoding
				mockOutputChannel,
			)

			const mockResponse = {
				data: [
					{
						embedding: [0.1, 0.2, 0.3], // First embedding
					},
					{
						embedding: [0.4, 0.5, 0.6], // Second embedding
					},
				],
				usage: {
					prompt_tokens: 20,
					total_tokens: 20,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			const result = await embedder.createEmbeddings(["text 1", "text 2"])

			// Assert
			expect(result.embeddings).toEqual([
				[0.1, 0.2, 0.3],
				[0.4, 0.5, 0.6],
			])
		})

		it("should log appropriate messages when using float encoding", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				true, // useFloatEncoding
				mockOutputChannel,
			)

			const mockResponse = {
				data: [
					{
						embedding: [0.1, 0.2, 0.3],
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			await embedder.createEmbeddings(["test text"])

			// Assert - check for logging messages
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("should log appropriate messages when using base64 encoding", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				false, // useFloatEncoding
				mockOutputChannel,
			)

			// Create a base64 encoded float array
			const floatArray = new Float32Array([0.1, 0.2, 0.3])
			const buffer = Buffer.from(floatArray.buffer)
			const base64String = buffer.toString("base64")

			const mockResponse = {
				data: [
					{
						embedding: base64String,
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			await embedder.createEmbeddings(["test text"])

			// Assert - check for logging messages
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("should handle errors gracefully with float encoding", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				true, // useFloatEncoding
				mockOutputChannel,
			)

			const error = new Error("Unauthorized") as any
			error.status = 401
			mockOpenAICreate.mockRejectedValueOnce(error)

			// Act & Assert
			await expect(embedder.createEmbeddings(["test text"])).rejects.toThrow()

			// Error should be logged
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("should validate configuration with float encoding", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				true, // useFloatEncoding
				mockOutputChannel,
			)

			const mockResponse = {
				data: [
					{
						embedding: [0.1, 0.2, 0.3],
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(true)
			expect(mockOpenAICreate).toHaveBeenCalledWith({
				input: ["test"],
				model: modelId,
				encoding_format: "float",
			})
		})

		it("should default to false when useFloatEncoding is undefined", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(
				baseUrl,
				apiKey,
				modelId,
				undefined,
				undefined, // useFloatEncoding not specified
				mockOutputChannel,
			)

			// Create a base64 encoded float array
			const floatArray = new Float32Array([0.1, 0.2, 0.3])
			const buffer = Buffer.from(floatArray.buffer)
			const base64String = buffer.toString("base64")

			const mockResponse = {
				data: [
					{
						embedding: base64String,
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			await embedder.createEmbeddings(["test text"])

			// Assert
			expect(mockOpenAICreate).toHaveBeenCalledWith({
				input: ["test text"],
				model: modelId,
				encoding_format: "base64",
			})
		})
	})

	describe("Logging functionality", () => {
		it("should log initialization details", () => {
			// Arrange & Act
			embedder = new OpenAICompatibleEmbedder(baseUrl, apiKey, modelId, 1024, true, mockOutputChannel)

			// Assert - check that logging was called
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("should log request details", async () => {
			// Arrange
			embedder = new OpenAICompatibleEmbedder(baseUrl, apiKey, modelId, undefined, true, mockOutputChannel)

			const mockResponse = {
				data: [
					{
						embedding: [0.1, 0.2, 0.3],
					},
				],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			mockOpenAICreate.mockResolvedValueOnce(mockResponse)

			// Act
			await embedder.createEmbeddings(["test text"])

			// Assert - check that logging was called
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})
	})
})
