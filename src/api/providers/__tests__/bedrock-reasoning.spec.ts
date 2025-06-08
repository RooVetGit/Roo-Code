import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock AWS SDK modules before importing the handler
vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn(),
}))

// Define a shared mock for the send function that will be used by all instances
const sharedMockSend = vi.fn()

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
	BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
		// Ensure all instances of BedrockRuntimeClient use the sharedMockSend
		send: sharedMockSend,
		config: { region: "us-east-1" },
	})),
	ConverseStreamCommand: vi.fn(), // This will be the mock constructor for ConverseStreamCommand
	ConverseCommand: vi.fn(),
}))

// Import after mocks are set up
import { AwsBedrockHandler } from "../bedrock"
// Import ConverseStreamCommand to check its mock constructor (which is vi.fn() from the mock factory)
import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime"

describe("AwsBedrockHandler - Extended Thinking", () => {
	let handler: AwsBedrockHandler
	// This will hold the reference to sharedMockSend for use in tests
	let mockSend: typeof sharedMockSend

	const mockOptions = {
		awsRegion: "us-east-1",
		apiModelId: "anthropic.claude-3-7-sonnet-20241029-v1:0",
		enableReasoningEffort: false, // Default to false
		modelTemperature: 0.7,
	}

	beforeEach(() => {
		// Clear all mocks. This will clear sharedMockSend and the ConverseStreamCommand mock constructor.
		vi.clearAllMocks()
		// Assign the shared mock to mockSend so tests can configure it.
		mockSend = sharedMockSend

		// AwsBedrockHandler will instantiate BedrockRuntimeClient, which will get the sharedMockSend.
		handler = new AwsBedrockHandler(mockOptions)
	})

	describe("Extended Thinking Configuration", () => {
		it("should NOT enable extended thinking by default", async () => {
			// Setup mock response
			mockSend.mockResolvedValue({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield {
						contentBlockStart: {
							start: { text: "Hello" },
							contentBlockIndex: 0,
						},
					}
					yield { messageStop: { stopReason: "end_turn" } }
				})(),
			})

			// Create message
			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("", messages)

			// Consume stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the command was called
			expect(ConverseStreamCommand).toHaveBeenCalled()
			const payload = (ConverseStreamCommand as any).mock.calls[0][0]

			// Extended thinking should NOT be enabled by default
			expect(payload.anthropic_version).toBeUndefined()
			expect(payload.additionalModelRequestFields).toBeUndefined()
			expect(payload.inferenceConfig.temperature).toBeDefined()
			expect(payload.inferenceConfig.topP).toBeDefined()
		})

		it("should enable extended thinking when explicitly enabled with reasoning budget", async () => {
			// Enable reasoning mode with thinking tokens
			handler = new AwsBedrockHandler({
				...mockOptions,
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 5000,
			})

			// Setup mock response with thinking blocks
			mockSend.mockResolvedValue({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield {
						contentBlockStart: {
							contentBlock: {
								type: "thinking",
								thinking: "Let me think about this...",
							},
							contentBlockIndex: 0,
						},
					}
					yield {
						contentBlockStart: {
							start: { text: "Here is my response" },
							contentBlockIndex: 1,
						},
					}
					yield { messageStop: { stopReason: "end_turn" } }
				})(),
			})

			// Create message
			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("", messages)

			// Consume stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the command was called
			expect(ConverseStreamCommand).toHaveBeenCalled()
			const payload = (ConverseStreamCommand as any).mock.calls[0][0]

			// Extended thinking should be enabled
			expect(payload.anthropic_version).toBe("bedrock-20250514")
			expect(payload.additionalModelRequestFields).toEqual({
				thinking: {
					type: "enabled",
					budget_tokens: 5000,
				},
			})
			// Temperature and topP should be removed
			expect(payload.inferenceConfig.temperature).toBeUndefined()
			expect(payload.inferenceConfig.topP).toBeUndefined()

			// Verify thinking content was processed
			const reasoningChunk = chunks.find((c) => c.type === "reasoning")
			expect(reasoningChunk).toBeDefined()
			expect(reasoningChunk?.text).toBe("Let me think about this...")
		})

		it("should NOT enable extended thinking for unsupported models", async () => {
			// Use a model that doesn't support reasoning
			handler = new AwsBedrockHandler({
				...mockOptions,
				apiModelId: "anthropic.claude-3-haiku-20240307-v1:0",
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 5000,
			})

			// Setup mock response
			mockSend.mockResolvedValue({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield {
						contentBlockStart: {
							start: { text: "Hello" },
							contentBlockIndex: 0,
						},
					}
					yield { messageStop: { stopReason: "end_turn" } }
				})(),
			})

			// Create message
			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("", messages)

			// Consume stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the command was called
			expect(ConverseStreamCommand).toHaveBeenCalled()
			const payload = (ConverseStreamCommand as any).mock.calls[0][0]

			// Extended thinking should NOT be enabled for unsupported models
			expect(payload.anthropic_version).toBeUndefined()
			expect(payload.additionalModelRequestFields).toBeUndefined()
			expect(payload.inferenceConfig.temperature).toBeDefined()
			expect(payload.inferenceConfig.topP).toBeDefined()
		})
	})

	describe("Stream Processing", () => {
		it("should handle thinking delta events", async () => {
			// Enable reasoning mode
			handler = new AwsBedrockHandler({
				...mockOptions,
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 5000,
			})

			// Setup mock response with thinking deltas
			mockSend.mockResolvedValue({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield {
						contentBlockDelta: {
							delta: {
								type: "thinking_delta",
								thinking: "First part of thinking...",
							},
							contentBlockIndex: 0,
						},
					}
					yield {
						contentBlockDelta: {
							delta: {
								type: "thinking_delta",
								thinking: " Second part of thinking.",
							},
							contentBlockIndex: 0,
						},
					}
					yield { messageStop: { stopReason: "end_turn" } }
				})(),
			})

			// Create message
			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("", messages)

			// Consume stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify thinking deltas were processed
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("First part of thinking...")
			expect(reasoningChunks[1].text).toBe(" Second part of thinking.")
		})

		it("should handle signature delta events as reasoning", async () => {
			// Enable reasoning mode
			handler = new AwsBedrockHandler({
				...mockOptions,
				enableReasoningEffort: true,
				modelMaxThinkingTokens: 5000,
			})

			// Setup mock response with signature deltas
			mockSend.mockResolvedValue({
				stream: (async function* () {
					yield { messageStart: { role: "assistant" } }
					yield {
						contentBlockDelta: {
							delta: {
								type: "signature_delta",
								signature: "[Signature content]",
							},
							contentBlockIndex: 0,
						},
					}
					yield { messageStop: { stopReason: "end_turn" } }
				})(),
			})

			// Create message
			const messages = [{ role: "user" as const, content: "Test message" }]
			const stream = handler.createMessage("", messages)

			// Consume stream
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify signature delta was processed as reasoning
			const reasoningChunk = chunks.find((c) => c.type === "reasoning")
			expect(reasoningChunk).toBeDefined()
			expect(reasoningChunk?.text).toBe("[Signature content]")
		})
	})
})
