// npx vitest run src/api/providers/__tests__/sapaicore.spec.ts

import { SapAiCoreHandler } from "../sapaicore.js"
import { sapAiCoreModels } from "@roo-code/types/src/providers/sapaicore"
import type { ApiHandlerOptions } from "../../../shared/api.js"
import axios from "axios"

vitest.mock("axios")
const mockedAxios = vitest.mocked(axios)

describe("SapAiCoreHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		apiModelId: "anthropic--claude-3.5-sonnet",
		sapAiCoreClientId: "test-client-id",
		sapAiCoreClientSecret: "test-client-secret",
		sapAiCoreTokenUrl: "https://test.sapaicore.ai/oauth/token",
		sapAiCoreBaseUrl: "https://test.sapaicore.ai",
		sapAiResourceGroup: "test-group",
	}

	let handler: SapAiCoreHandler

	beforeEach(() => {
		handler = new SapAiCoreHandler(mockOptions)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create handler with valid options", () => {
			expect(handler).toBeInstanceOf(SapAiCoreHandler)
		})

		it("should get model info correctly", () => {
			const model = handler.getModel()
			expect(model.id).toBe("anthropic--claude-3.5-sonnet")
			expect(model.info).toBeDefined()
		})
	})

	describe("createMessage", () => {
		it("should handle successful streaming response", async () => {
			// Mock successful auth
			mockedAxios.post.mockResolvedValueOnce({
				data: { access_token: "test-access-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with correct deployment structure
			mockedAxios.get.mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock streaming response - should be an async iterable
			const mockStreamData = [
				'data: {"type": "message_start", "message": {"usage": {"input_tokens": 10, "output_tokens": 5}}}\n\n',
				'data: {"type": "content_block_start", "content_block": {"type": "text", "text": "Hello"}}\n\n',
				'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world"}}\n\n',
				'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "usage": {"output_tokens": 15}}}\n\n',
				"data: [DONE]\n\n",
			]

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStreamData) {
						yield chunk
					}
				},
			}

			mockedAxios.post.mockResolvedValueOnce({
				data: mockStream,
			})

			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some((chunk) => chunk.type === "text")).toBe(true)
		})
	})

	describe("completePrompt", () => {
		it("should complete a simple prompt", async () => {
			// Mock successful auth
			mockedAxios.post.mockResolvedValueOnce({
				data: { access_token: "test-access-token", expires_in: 3600 },
				status: 200,
			})

			// Mock deployments response with correct deployment structure
			mockedAxios.get.mockResolvedValueOnce({
				data: {
					resources: [
						{
							id: "test-deployment-123",
							targetStatus: "RUNNING",
							details: {
								resources: {
									backend_details: {
										model: {
											name: "anthropic--claude-3.5-sonnet",
											version: "1.0",
										},
									},
								},
							},
						},
					],
				},
			})

			// Mock streaming response - should be an async iterable
			const mockStreamData = [
				'data: {"type": "message_start", "message": {"usage": {"input_tokens": 10, "output_tokens": 5}}}\n\n',
				'data: {"type": "content_block_start", "content_block": {"type": "text", "text": "Test response"}}\n\n',
				'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "usage": {"output_tokens": 15}}}\n\n',
				"data: [DONE]\n\n",
			]

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					for (const chunk of mockStreamData) {
						yield chunk
					}
				},
			}

			mockedAxios.post.mockResolvedValueOnce({
				data: mockStream,
			})

			const result = await handler.completePrompt("Hello")
			expect(typeof result).toBe("string")
			expect(result).toContain("Test response")
		})
	})
})
