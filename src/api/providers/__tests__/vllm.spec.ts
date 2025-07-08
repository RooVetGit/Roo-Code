import { describe, it, expect, beforeEach, vi } from "vitest"
import { VLLMProvider } from "../vllm"
import type { ChatMessage } from "@roo-code/types"

// Mock fetch
global.fetch = vi.fn()
const mockFetch = global.fetch as any

describe("VLLMProvider", () => {
	let provider: VLLMProvider

	beforeEach(() => {
		mockFetch.mockClear()
		provider = new VLLMProvider({
			baseUrl: "http://gpu-srv:1234/v1",
			apiKey: "test-key",
		})
	})

	describe("constructor", () => {
		it("should set default baseUrl for vLLM", () => {
			const defaultProvider = new VLLMProvider({})
			expect(defaultProvider.options.baseUrl).toBe("http://localhost:8000/v1")
		})

		it("should use provided baseUrl", () => {
			expect(provider.options.baseUrl).toBe("http://gpu-srv:1234/v1")
		})

		it("should handle URLs without /v1 suffix", () => {
			const provider = new VLLMProvider({
				baseUrl: "http://gpu-srv:1234",
			})
			expect(provider.options.baseUrl).toBe("http://gpu-srv:1234/v1")
		})
	})

	describe("complete", () => {
		const messages: ChatMessage[] = [{ type: "human", content: "Hello, how are you?" }]

		beforeEach(() => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [
							{
								message: {
									role: "assistant",
									content: "I'm doing well, thank you!",
								},
							},
						],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 8,
							total_tokens: 18,
						},
					}),
			})
		})

		it("should make correct API call to vLLM", async () => {
			await provider.complete("llama-2-7b-chat", messages)

			expect(mockFetch).toHaveBeenCalledWith(
				"http://gpu-srv:1234/v1/chat/completions",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-key",
					}),
					body: expect.stringContaining('"model":"llama-2-7b-chat"'),
				}),
			)
		})

		it("should transform messages correctly", async () => {
			await provider.complete("llama-2-7b-chat", messages)

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.messages).toEqual([
				{
					role: "user",
					content: "Hello, how are you?",
				},
			])
		})

		it("should handle streaming responses", async () => {
			const mockStream = new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
					)
					controller.enqueue(
						new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'),
					)
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			})

			mockFetch.mockResolvedValue({
				ok: true,
				body: mockStream,
			})

			const response = await provider.complete("llama-2-7b-chat", messages, {
				stream: true,
			})

			expect(response.stream).toBeDefined()
		})

		it("should handle vLLM specific parameters", async () => {
			await provider.complete("llama-2-7b-chat", messages, {
				temperature: 0.7,
				max_tokens: 1024,
				top_p: 0.9,
			})

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody).toMatchObject({
				model: "llama-2-7b-chat",
				temperature: 0.7,
				max_tokens: 1024,
				top_p: 0.9,
			})
		})

		it("should handle errors gracefully", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("vLLM server error"),
			})

			await expect(provider.complete("llama-2-7b-chat", messages)).rejects.toThrow(
				"vLLM API error: 500 - Internal Server Error",
			)
		})
	})

	describe("listModels", () => {
		it("should fetch available models from vLLM", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{ id: "llama-2-7b-chat", object: "model" },
							{ id: "codellama-13b", object: "model" },
						],
					}),
			})

			const models = await provider.listModels()

			expect(mockFetch).toHaveBeenCalledWith(
				"http://gpu-srv:1234/v1/models",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-key",
					}),
				}),
			)

			expect(models).toEqual([
				{ id: "llama-2-7b-chat", name: "llama-2-7b-chat" },
				{ id: "codellama-13b", name: "codellama-13b" },
			])
		})

		it("should handle models endpoint errors", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
			})

			await expect(provider.listModels()).rejects.toThrow("Failed to fetch models: 404 - Not Found")
		})
	})

	describe("validateConnection", () => {
		it("should validate connection to vLLM server", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})

			const isValid = await provider.validateConnection()

			expect(isValid).toBe(true)
			expect(mockFetch).toHaveBeenCalledWith("http://gpu-srv:1234/v1/models", expect.any(Object))
		})

		it("should return false for invalid connections", async () => {
			mockFetch.mockRejectedValue(new Error("Connection failed"))

			const isValid = await provider.validateConnection()

			expect(isValid).toBe(false)
		})
	})
})
