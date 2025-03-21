import { SinglePointStrategy } from "../single-point-strategy"
import { MultiPointStrategy } from "../multi-point-strategy"
import { CacheStrategy } from "../base-strategy"
import { CacheStrategyConfig, ModelInfo } from "../types"
import { ContentBlock, SystemContentBlock } from "@aws-sdk/client-bedrock-runtime"
import { Anthropic } from "@anthropic-ai/sdk"
import { AwsBedrockHandler } from "../../../providers/bedrock"
import { BedrockRuntimeClient, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime"

// Common test utilities
const defaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsPromptCache: true,
	maxCachePoints: 4,
	minTokensPerCachePoint: 50,
	cachableFields: ["system", "messages", "tools"],
}

const createConfig = (overrides: Partial<CacheStrategyConfig> = {}): CacheStrategyConfig => ({
	modelInfo: {
		...defaultModelInfo,
		...(overrides.modelInfo || {}),
	},
	systemPrompt: "You are a helpful assistant",
	messages: [],
	usePromptCache: true,
	...overrides,
})

const createMessageWithTokens = (role: "user" | "assistant", tokenCount: number) => ({
	role,
	content: "x".repeat(tokenCount * 4), // Approximate 4 chars per token
})

const hasCachePoint = (block: ContentBlock | SystemContentBlock): boolean => {
	return (
		"cachePoint" in block &&
		typeof block.cachePoint === "object" &&
		block.cachePoint !== null &&
		"type" in block.cachePoint &&
		block.cachePoint.type === "default"
	)
}

// Create a mock object to store the last config passed to convertToBedrockConverseMessages
interface CacheConfig {
	modelInfo: any
	systemPrompt?: string
	messages: any[]
	usePromptCache: boolean
}

const convertToBedrockConverseMessagesMock = {
	lastConfig: null as CacheConfig | null,
	result: null as any,
}

describe("Cache Strategy", () => {
	// SECTION 1: Direct Strategy Implementation Tests
	describe("Strategy Implementation", () => {
		describe("Strategy Selection", () => {
			it("should use SinglePointStrategy when caching is not supported", () => {
				const config = createConfig({
					modelInfo: { ...defaultModelInfo, supportsPromptCache: false },
				})

				const strategy = new SinglePointStrategy(config)
				expect(strategy).toBeInstanceOf(SinglePointStrategy)
			})

			it("should use SinglePointStrategy when caching is disabled", () => {
				const config = createConfig({ usePromptCache: false })

				const strategy = new SinglePointStrategy(config)
				expect(strategy).toBeInstanceOf(SinglePointStrategy)
			})

			it("should use SinglePointStrategy when maxCachePoints is 1", () => {
				const config = createConfig({
					modelInfo: { ...defaultModelInfo, maxCachePoints: 1 },
				})

				const strategy = new SinglePointStrategy(config)
				expect(strategy).toBeInstanceOf(SinglePointStrategy)
			})

			it("should use MultiPointStrategy for multi-point cases", () => {
				// Setup: Using multiple messages to test multi-point strategy
				const config = createConfig({
					messages: [createMessageWithTokens("user", 50), createMessageWithTokens("assistant", 50)],
					modelInfo: {
						...defaultModelInfo,
						maxCachePoints: 4,
						minTokensPerCachePoint: 50,
					},
				})

				const strategy = new MultiPointStrategy(config)
				expect(strategy).toBeInstanceOf(MultiPointStrategy)
			})
		})

		describe("Message Formatting with Cache Points", () => {
			test("converts simple text messages correctly", () => {
				const config = createConfig({
					messages: [
						{ role: "user", content: "Hello" },
						{ role: "assistant", content: "Hi there" },
					],
					systemPrompt: "",
					modelInfo: { ...defaultModelInfo, supportsPromptCache: false },
				})

				const strategy = new SinglePointStrategy(config)
				const result = strategy.determineOptimalCachePoints()

				expect(result.messages).toEqual([
					{
						role: "user",
						content: [{ text: "Hello" }],
					},
					{
						role: "assistant",
						content: [{ text: "Hi there" }],
					},
				])
			})

			describe("system cache block insertion", () => {
				test("adds system cache block when prompt caching is enabled, messages exist, and system prompt is long enough", () => {
					// Create a system prompt that's at least 50 tokens (200+ characters)
					const longSystemPrompt =
						"You are a helpful assistant that provides detailed and accurate information. " +
						"You should always be polite, respectful, and considerate of the user's needs. " +
						"When answering questions, try to provide comprehensive explanations that are easy to understand. " +
						"If you don't know something, be honest about it rather than making up information."

					const config = createConfig({
						messages: [{ role: "user", content: "Hello" }],
						systemPrompt: longSystemPrompt,
						modelInfo: {
							...defaultModelInfo,
							supportsPromptCache: true,
							cachableFields: ["system", "messages", "tools"],
						},
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Check that system blocks include both the text and a cache block
					expect(result.system).toHaveLength(2)
					expect(result.system[0]).toEqual({ text: longSystemPrompt })
					expect(hasCachePoint(result.system[1])).toBe(true)
				})

				test("adds system cache block when model info specifies it should", () => {
					const shortSystemPrompt = "You are a helpful assistant"

					const config = createConfig({
						messages: [{ role: "user", content: "Hello" }],
						systemPrompt: shortSystemPrompt,
						modelInfo: {
							...defaultModelInfo,
							supportsPromptCache: true,
							minTokensPerCachePoint: 1, // Set to 1 to ensure it passes the threshold
							cachableFields: ["system", "messages", "tools"],
						},
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Check that system blocks include both the text and a cache block
					expect(result.system).toHaveLength(2)
					expect(result.system[0]).toEqual({ text: shortSystemPrompt })
					expect(hasCachePoint(result.system[1])).toBe(true)
				})

				test("does not add system cache block when system prompt is too short", () => {
					const shortSystemPrompt = "You are a helpful assistant"

					const config = createConfig({
						messages: [{ role: "user", content: "Hello" }],
						systemPrompt: shortSystemPrompt,
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Check that system blocks only include the text, no cache block
					expect(result.system).toHaveLength(1)
					expect(result.system[0]).toEqual({ text: shortSystemPrompt })
				})

				test("does not add cache blocks when messages array is empty even if prompt caching is enabled", () => {
					const config = createConfig({
						messages: [],
						systemPrompt: "You are a helpful assistant",
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Check that system blocks only include the text, no cache block
					expect(result.system).toHaveLength(1)
					expect(result.system[0]).toEqual({ text: "You are a helpful assistant" })

					// Verify no messages or cache blocks were added
					expect(result.messages).toHaveLength(0)
				})

				test("does not add system cache block when prompt caching is disabled", () => {
					const config = createConfig({
						messages: [{ role: "user", content: "Hello" }],
						systemPrompt: "You are a helpful assistant",
						usePromptCache: false,
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Check that system blocks only include the text
					expect(result.system).toHaveLength(1)
					expect(result.system[0]).toEqual({ text: "You are a helpful assistant" })
				})

				test("does not insert message cache blocks when prompt caching is disabled", () => {
					// Create a long conversation that would trigger cache blocks if enabled
					const messages: Anthropic.Messages.MessageParam[] = Array(10)
						.fill(null)
						.map((_, i) => ({
							role: i % 2 === 0 ? "user" : "assistant",
							content:
								"This is message " +
								(i + 1) +
								" with some additional text to increase token count. " +
								"Adding more text to ensure we exceed the token threshold for cache block insertion.",
						}))

					const config = createConfig({
						messages,
						systemPrompt: "",
						usePromptCache: false,
					})

					const strategy = new SinglePointStrategy(config)
					const result = strategy.determineOptimalCachePoints()

					// Verify no cache blocks were inserted
					expect(result.messages).toHaveLength(10)
					result.messages.forEach((message) => {
						if (message.content) {
							message.content.forEach((block) => {
								expect(hasCachePoint(block)).toBe(false)
							})
						}
					})
				})
			})
		})
	})

	// SECTION 2: AwsBedrockHandler Integration Tests
	describe("AwsBedrockHandler Integration", () => {
		let handler: AwsBedrockHandler

		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		beforeEach(() => {
			// Clear all mocks before each test
			jest.clearAllMocks()

			// Create a handler with prompt cache enabled and a model that supports it
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0", // This model supports prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Mock the getModel method to return a model with cachableFields and multi-point support
			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system", "messages"],
					maxCachePoints: 4, // Support for multiple cache points
					minTokensPerCachePoint: 50,
				},
			})

			// Mock the client.send method
			const mockInvoke = jest.fn().mockResolvedValue({
				stream: {
					[Symbol.asyncIterator]: async function* () {
						yield {
							metadata: {
								usage: {
									inputTokens: 10,
									outputTokens: 5,
								},
							},
						}
					},
				},
			})

			handler["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			// Mock the convertToBedrockConverseMessages method to capture the config
			jest.spyOn(handler as any, "convertToBedrockConverseMessages").mockImplementation(function (
				...args: any[]
			) {
				const messages = args[0]
				const systemMessage = args[1]
				const usePromptCache = args[2]
				const modelInfo = args[3]

				// Store the config for later inspection
				const config: CacheConfig = {
					modelInfo,
					systemPrompt: systemMessage,
					messages,
					usePromptCache,
				}
				convertToBedrockConverseMessagesMock.lastConfig = config

				// Create a strategy based on the config
				let strategy
				if (!modelInfo.supportsPromptCache || !usePromptCache) {
					strategy = new SinglePointStrategy(config as any)
				} else if (modelInfo.maxCachePoints <= 1) {
					strategy = new SinglePointStrategy(config as any)
				} else {
					strategy = new MultiPointStrategy(config as any)
				}

				// Store the result
				const result = strategy.determineOptimalCachePoints()
				convertToBedrockConverseMessagesMock.result = result

				return result
			})
		})

		it("should select MultiPointStrategy when conditions are met", async () => {
			// Reset the mock
			convertToBedrockConverseMessagesMock.lastConfig = null

			// Call the method that uses convertToBedrockConverseMessages
			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify that convertToBedrockConverseMessages was called with the right parameters
			expect(convertToBedrockConverseMessagesMock.lastConfig).toMatchObject({
				modelInfo: expect.objectContaining({
					supportsPromptCache: true,
					maxCachePoints: 4,
				}),
				usePromptCache: true,
			})

			// Verify that the config would result in a MultiPointStrategy
			expect(convertToBedrockConverseMessagesMock.lastConfig).not.toBeNull()
			if (convertToBedrockConverseMessagesMock.lastConfig) {
				const strategy = new MultiPointStrategy(convertToBedrockConverseMessagesMock.lastConfig as any)
				expect(strategy).toBeInstanceOf(MultiPointStrategy)
			}
		})

		it("should select SinglePointStrategy when maxCachePoints is 1", async () => {
			// Mock the getModel method to return a model with only single-point support
			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system"],
					maxCachePoints: 1, // Only supports one cache point
					minTokensPerCachePoint: 50,
				},
			})

			// Reset the mock
			convertToBedrockConverseMessagesMock.lastConfig = null

			// Call the method that uses convertToBedrockConverseMessages
			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify that convertToBedrockConverseMessages was called with the right parameters
			expect(convertToBedrockConverseMessagesMock.lastConfig).toMatchObject({
				modelInfo: expect.objectContaining({
					supportsPromptCache: true,
					maxCachePoints: 1,
				}),
				usePromptCache: true,
			})

			// Verify that the config would result in a SinglePointStrategy
			expect(convertToBedrockConverseMessagesMock.lastConfig).not.toBeNull()
			if (convertToBedrockConverseMessagesMock.lastConfig) {
				const strategy = new SinglePointStrategy(convertToBedrockConverseMessagesMock.lastConfig as any)
				expect(strategy).toBeInstanceOf(SinglePointStrategy)
			}
		})

		it("should select SinglePointStrategy when prompt cache is disabled", async () => {
			// Create a handler with prompt cache disabled
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: false, // Prompt cache disabled
			})

			// Mock the getModel method
			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system", "messages"],
					maxCachePoints: 4,
					minTokensPerCachePoint: 50,
				},
			})

			// Mock the client.send method
			const mockInvoke = jest.fn().mockResolvedValue({
				stream: {
					[Symbol.asyncIterator]: async function* () {
						yield {
							metadata: {
								usage: {
									inputTokens: 10,
									outputTokens: 5,
								},
							},
						}
					},
				},
			})

			handler["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			// Mock the convertToBedrockConverseMessages method again for the new handler
			jest.spyOn(handler as any, "convertToBedrockConverseMessages").mockImplementation(function (
				...args: any[]
			) {
				const messages = args[0]
				const systemMessage = args[1]
				const usePromptCache = args[2]
				const modelInfo = args[3]

				// Store the config for later inspection
				const config: CacheConfig = {
					modelInfo,
					systemPrompt: systemMessage,
					messages,
					usePromptCache,
				}
				convertToBedrockConverseMessagesMock.lastConfig = config

				// Create a strategy based on the config
				let strategy
				if (!modelInfo.supportsPromptCache || !usePromptCache) {
					strategy = new SinglePointStrategy(config as any)
				} else if (modelInfo.maxCachePoints <= 1) {
					strategy = new SinglePointStrategy(config as any)
				} else {
					strategy = new MultiPointStrategy(config as any)
				}

				// Store the result
				const result = strategy.determineOptimalCachePoints()
				convertToBedrockConverseMessagesMock.result = result

				return result
			})

			// Reset the mock
			convertToBedrockConverseMessagesMock.lastConfig = null

			// Call the method that uses convertToBedrockConverseMessages
			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify that convertToBedrockConverseMessages was called with the right parameters
			expect(convertToBedrockConverseMessagesMock.lastConfig).toMatchObject({
				usePromptCache: false,
			})

			// Verify that the config would result in a SinglePointStrategy
			expect(convertToBedrockConverseMessagesMock.lastConfig).not.toBeNull()
			if (convertToBedrockConverseMessagesMock.lastConfig) {
				const strategy = new SinglePointStrategy(convertToBedrockConverseMessagesMock.lastConfig as any)
				expect(strategy).toBeInstanceOf(SinglePointStrategy)
			}
		})

		it("should include cachePoint nodes in API request when using MultiPointStrategy", async () => {
			// Mock the convertToBedrockConverseMessages method to return a result with cache points
			;(handler as any).convertToBedrockConverseMessages.mockReturnValueOnce({
				system: [{ text: systemPrompt }, { cachePoint: { type: "default" } }],
				messages: mockMessages.map((msg: any) => ({
					role: msg.role,
					content: [{ text: typeof msg.content === "string" ? msg.content : msg.content[0].text }],
				})),
			})

			// Create a spy for the client.send method
			const mockSend = jest.fn().mockResolvedValue({
				stream: {
					[Symbol.asyncIterator]: async function* () {
						yield {
							metadata: {
								usage: {
									inputTokens: 10,
									outputTokens: 5,
								},
							},
						}
					},
				},
			})

			handler["client"] = {
				send: mockSend,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			// Call the method that uses convertToBedrockConverseMessages
			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify that the API request included system with cachePoint
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						system: expect.arrayContaining([
							expect.objectContaining({
								text: systemPrompt,
							}),
							expect.objectContaining({
								cachePoint: expect.anything(),
							}),
						]),
					}),
				}),
				expect.anything(),
			)
		})

		it("should yield usage results with cache tokens when using MultiPointStrategy", async () => {
			// Mock the convertToBedrockConverseMessages method to return a result with cache points
			;(handler as any).convertToBedrockConverseMessages.mockReturnValueOnce({
				system: [{ text: systemPrompt }, { cachePoint: { type: "default" } }],
				messages: mockMessages.map((msg: any) => ({
					role: msg.role,
					content: [{ text: typeof msg.content === "string" ? msg.content : msg.content[0].text }],
				})),
			})

			// Create a mock stream that includes cache token fields
			const mockApiResponse = {
				metadata: {
					usage: {
						inputTokens: 10,
						outputTokens: 5,
						cacheReadInputTokens: 5,
						cacheWriteInputTokens: 10,
					},
				},
			}

			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield mockApiResponse
				},
			}

			const mockSend = jest.fn().mockImplementation(() => {
				return Promise.resolve({
					stream: mockStream,
				})
			})

			handler["client"] = {
				send: mockSend,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			// Call the method that uses convertToBedrockConverseMessages
			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that usage results with cache tokens are yielded
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheReadTokens: 5,
				cacheWriteTokens: 10,
			})
		})
	})
})
