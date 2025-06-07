import { AwsBedrockHandler } from "../bedrock"
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"

// Mock the AWS SDK
jest.mock("@aws-sdk/client-bedrock-runtime")
jest.mock("@aws-sdk/credential-providers")

describe("AwsBedrockHandler - Extended Thinking/Reasoning", () => {
	let mockClient: jest.Mocked<BedrockRuntimeClient>
	let mockSend: jest.Mock

	beforeEach(() => {
		jest.clearAllMocks()
		mockSend = jest.fn()
		mockClient = {
			send: mockSend,
			config: { region: "us-east-1" },
		} as any
		;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => mockClient)
	})

	describe("Extended Thinking Configuration", () => {
		it("should NOT include thinking configuration by default", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
				awsRegion: "us-east-1",
				// enableReasoningEffort is NOT set, so reasoning should be disabled
			})

			// Mock the stream response
			mockSend.mockResolvedValueOnce({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield { contentBlockStart: { start: { text: "Hello" } } }
					yield { messageStop: {} }
				})(),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			// Consume the stream
			for await (const _chunk of stream) {
				// Just consume
			}

			// Verify the command was called
			expect(mockSend).toHaveBeenCalledTimes(1)
			const command = mockSend.mock.calls[0][0]
			const payload = command.input

			// Verify thinking is NOT included
			expect(payload.anthropic_version).toBeUndefined()
			expect(payload.additionalModelRequestFields).toBeUndefined()
			expect(payload.inferenceConfig.temperature).toBeDefined()
			expect(payload.inferenceConfig.topP).toBeDefined()
		})

		it("should include thinking configuration when explicitly enabled", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
				awsRegion: "us-east-1",
				enableReasoningEffort: true, // Explicitly enable reasoning
				modelMaxThinkingTokens: 5000, // Set thinking tokens
			})

			// Mock the stream response
			mockSend.mockResolvedValueOnce({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield { contentBlockStart: { contentBlock: { type: "thinking", thinking: "Let me think..." } } }
					yield { contentBlockDelta: { delta: { type: "thinking_delta", thinking: " about this." } } }
					yield { contentBlockStart: { start: { text: "Here's my answer" } } }
					yield { messageStop: {} }
				})(),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			// Consume the stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the command was called
			expect(mockSend).toHaveBeenCalledTimes(1)
			const command = mockSend.mock.calls[0][0]
			const payload = command.input

			// Verify thinking IS included
			expect(payload.anthropic_version).toBe("bedrock-20250514")
			expect(payload.additionalModelRequestFields).toEqual({
				thinking: {
					type: "enabled",
					budget_tokens: 5000,
				},
			})
			// Temperature and topP should be removed when thinking is enabled
			expect(payload.inferenceConfig.temperature).toBeUndefined()
			expect(payload.inferenceConfig.topP).toBeUndefined()

			// Verify thinking chunks were properly handled
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think...")
			expect(reasoningChunks[1].text).toBe(" about this.")
		})

		it("should NOT enable thinking for non-supported models even if requested", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-haiku-20240307-v1:0", // This model doesn't support reasoning
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
				awsRegion: "us-east-1",
				enableReasoningEffort: true, // Try to enable reasoning
				modelMaxThinkingTokens: 5000,
			})

			// Mock the stream response
			mockSend.mockResolvedValueOnce({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield { contentBlockStart: { start: { text: "Hello" } } }
					yield { messageStop: {} }
				})(),
			})

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			// Consume the stream
			for await (const _chunk of stream) {
				// Just consume
			}

			// Verify the command was called
			expect(mockSend).toHaveBeenCalledTimes(1)
			const command = mockSend.mock.calls[0][0]
			const payload = command.input

			// Verify thinking is NOT included because model doesn't support it
			expect(payload.anthropic_version).toBeUndefined()
			expect(payload.additionalModelRequestFields).toBeUndefined()
		})

		it("should handle thinking stream events correctly", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 8000,
			})

			// Mock the stream response with various thinking events
			mockSend.mockResolvedValueOnce({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					// Thinking block start
					yield {
						contentBlockStart: { contentBlock: { type: "thinking", thinking: "Analyzing the request..." } },
					}
					// Thinking deltas
					yield {
						contentBlockDelta: { delta: { type: "thinking_delta", thinking: "\nThis seems complex." } },
					}
					yield {
						contentBlockDelta: { delta: { type: "thinking_delta", thinking: "\nLet me break it down." } },
					}
					// Signature delta (part of thinking)
					yield {
						contentBlockDelta: { delta: { type: "signature_delta", signature: "\n[Signature: ABC123]" } },
					}
					// Regular text response
					yield { contentBlockStart: { start: { text: "Based on my analysis" } } }
					yield { contentBlockDelta: { delta: { text: ", here's the answer." } } }
					yield { messageStop: {} }
				})(),
			})

			const messages = [{ role: "user" as const, content: "Complex question" }]
			const stream = handler.createMessage("System prompt", messages)

			// Collect all chunks
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify reasoning chunks
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(4)
			expect(reasoningChunks.map((c) => c.text).join("")).toBe(
				"Analyzing the request...\nThis seems complex.\nLet me break it down.\n[Signature: ABC123]",
			)

			// Verify text chunks
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks.map((c) => c.text).join("")).toBe("Based on my analysis, here's the answer.")
		})
	})

	describe("Error Handling for Extended Thinking", () => {
		it("should provide helpful error message for thinking-related errors", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsAccessKey: "test-key",
				awsSecretKey: "test-secret",
				awsRegion: "us-east-1",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 5000,
			})

			// Mock an error response
			const error = new Error("ValidationException: additionalModelRequestFields.thinking is not supported")
			mockSend.mockRejectedValueOnce(error)

			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("System prompt", messages)

			// Collect error chunks
			const chunks = []
			try {
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			} catch (e) {
				// Expected to throw
			}

			// Should have error chunks before throwing
			expect(chunks).toHaveLength(2)
			expect(chunks[0].type).toBe("text")
			if (chunks[0].type === "text") {
				expect(chunks[0].text).toContain("Extended thinking/reasoning is not supported")
			}
			expect(chunks[1].type).toBe("usage")
		})
	})
})
