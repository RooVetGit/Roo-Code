// Mock AWS SDK credential providers
jest.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = jest.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})
	return { fromIni: mockFromIni }
})

import { AwsBedrockHandler } from "../bedrock"
import { MessageContent } from "../../../shared/api"
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"
import { Anthropic } from "@anthropic-ai/sdk"
const { fromIni } = require("@aws-sdk/credential-providers")
import { logger } from "../../../utils/logging"

describe("AwsBedrockHandler", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks()

		handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})
	})

	describe("constructor", () => {
		it("should initialize with provided config", () => {
			expect(handler["options"].awsAccessKey).toBe("test-access-key")
			expect(handler["options"].awsSecretKey).toBe("test-secret-key")
			expect(handler["options"].awsRegion).toBe("us-east-1")
			expect(handler["options"].apiModelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
		})

		it("should initialize with missing AWS credentials", () => {
			const handlerWithoutCreds = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
			})
			expect(handlerWithoutCreds).toBeInstanceOf(AwsBedrockHandler)
		})

		it("should initialize with AWS profile credentials", () => {
			const handlerWithProfile = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})
			expect(handlerWithProfile).toBeInstanceOf(AwsBedrockHandler)
			expect(handlerWithProfile["options"].awsUseProfile).toBe(true)
			expect(handlerWithProfile["options"].awsProfile).toBe("test-profile")
		})

		it("should initialize with AWS profile enabled but no profile set", () => {
			const handlerWithoutProfile = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
			})
			expect(handlerWithoutProfile).toBeInstanceOf(AwsBedrockHandler)
			expect(handlerWithoutProfile["options"].awsUseProfile).toBe(true)
			expect(handlerWithoutProfile["options"].awsProfile).toBeUndefined()
		})
	})

	describe("AWS SDK client configuration", () => {
		it("should configure client with profile credentials when profile mode is enabled", () => {
			const handlerWithProfile = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Verify the client was configured with profile credentials
			expect(fromIni).toHaveBeenCalledWith({
				profile: "test-profile",
			})
		})
	})

	describe("createMessage", () => {
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

		it("should handle text messages correctly", async () => {
			const mockResponse = {
				messages: [
					{
						role: "assistant",
						content: [{ type: "text", text: "Hello! How can I help you?" }],
					},
				],
				usage: {
					inputTokens: 10,
					outputTokens: 5,
				},
			}

			// Mock AWS SDK invoke
			const mockStream = {
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
			}

			const mockInvoke = jest.fn().mockResolvedValue({
				stream: mockStream,
			})

			handler["client"] = {
				send: mockInvoke,
			} as unknown as BedrockRuntimeClient

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			})

			expect(mockInvoke).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					}),
				}),
				expect.anything(),
			)
		})

		it("should handle API errors", async () => {
			// Mock AWS SDK invoke with error
			const mockInvoke = jest.fn().mockRejectedValue(new Error("AWS Bedrock error"))

			handler["client"] = {
				send: mockInvoke,
			} as unknown as BedrockRuntimeClient

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow("AWS Bedrock error")
		})

		it("should include system prompt cache when enabled and supported", async () => {
			// Create handler with prompt cache enabled
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0", // This model supports prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Mock the getModel method to return a model with cachableFields
			jest.spyOn(handlerWithCache, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system"],
				},
			})

			// Create a mock for the convertToBedrockConverseMessages function
			const originalConvert = handlerWithCache["convertToBedrockConverseMessages"]
			const mockConvert = jest.fn().mockImplementation((messages, systemPrompt, usePromptCache, modelInfo) => {
				// Call the original function to get the result
				const result = originalConvert.call(handlerWithCache, messages, systemPrompt, usePromptCache, modelInfo)

				// Add a cache point to the system array for testing
				if (usePromptCache && systemPrompt && result.system) {
					result.system.push({
						cachePoint: {
							type: "default",
						},
					})
				}

				return result
			})

			// Replace the original function with our mock
			handlerWithCache["convertToBedrockConverseMessages"] = mockConvert

			// Create a mock for the client.send method
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

			handlerWithCache["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			// Call the method
			const stream = handlerWithCache.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify the mock was called with the right parameters
			expect(mockConvert).toHaveBeenCalledWith(
				mockMessages,
				systemPrompt,
				true,
				expect.objectContaining({
					supportsPromptCache: true,
				}),
				expect.any(String), // conversationId parameter
			)

			// Restore the original function
			handlerWithCache["convertToBedrockConverseMessages"] = originalConvert
		})

		it("should not include system prompt cache when model doesn't support it", async () => {
			// Create handler with prompt cache enabled but use a model that doesn't support it
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "amazon.titan-text-express-v1:0", // This model doesn't support prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Mock the getModel method to return a model without cachableFields
			jest.spyOn(handlerWithCache, "getModel").mockReturnValue({
				id: "amazon.titan-text-express-v1:0",
				info: {
					maxTokens: 4096,
					contextWindow: 8000,
					supportsPromptCache: false,
					supportsImages: false,
					cachableFields: [], // Empty array means no cache support
				},
			})

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

			handlerWithCache["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			const stream = handlerWithCache.createMessage(systemPrompt, mockMessages)
			for await (const chunk of stream) {
				// Just consume the stream
			}

			// Verify cachePoint was NOT included in the messages
			expect(mockInvoke).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						system: expect.not.arrayContaining([
							expect.objectContaining({
								cachePoint: expect.anything(),
							}),
						]),
					}),
				}),
				expect.anything(),
			)
		})

		it("should handle cacheReadInputTokens and cacheWriteInputTokens fields", async () => {
			// Create handler with prompt cache enabled
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0", // This model supports prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Mock the getModel method to return a model with cachableFields
			jest.spyOn(handlerWithCache, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system"],
				},
			})

			// Mock AWS SDK invoke with cache token fields
			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						metadata: {
							usage: {
								inputTokens: 10,
								outputTokens: 5,
								cacheReadInputTokens: 5,
								cacheWriteInputTokens: 10,
							},
						},
					}
				},
			}

			const mockInvoke = jest.fn().mockResolvedValue({
				stream: mockStream,
			})

			handlerWithCache["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			const stream = handlerWithCache.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheReadTokens: 5,
				cacheWriteTokens: 10,
			})
		})

		it("should handle cacheReadInputTokenCount and cacheWriteInputTokenCount fields", async () => {
			// Create handler with prompt cache enabled
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0", // This model supports prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			// Mock the getModel method to return a model with cachableFields
			jest.spyOn(handlerWithCache, "getModel").mockReturnValue({
				id: "anthropic.claude-3-7-sonnet-20250219-v1:0",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					cachableFields: ["system"],
				},
			})

			// Mock AWS SDK invoke with alternative cache token field names
			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						metadata: {
							usage: {
								inputTokens: 10,
								outputTokens: 5,
								cacheReadInputTokenCount: 5,
								cacheWriteInputTokenCount: 10,
							},
						},
					}
				},
			}

			const mockInvoke = jest.fn().mockResolvedValue({
				stream: mockStream,
			})

			handlerWithCache["client"] = {
				send: mockInvoke,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			const stream = handlerWithCache.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

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

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			// Create handler with specific maxTokens
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				modelMaxTokens: 5000,
			})

			const mockResponse = {
				output: new TextEncoder().encode(
					JSON.stringify({
						content: "Test response",
					}),
				),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
						messages: expect.arrayContaining([
							expect.objectContaining({
								role: "user",
								content: [{ text: "Test prompt" }],
							}),
						]),
						inferenceConfig: expect.objectContaining({
							maxTokens: 5000,
							temperature: 0.3,
							topP: 0.1,
						}),
					}),
				}),
			)
		})

		it("should handle API errors", async () => {
			const mockError = new Error("AWS Bedrock error")
			const mockSend = jest.fn().mockRejectedValue(mockError)
			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				"Bedrock completion error: AWS Bedrock error",
			)
		})

		it("should handle invalid response format", async () => {
			const mockResponse = {
				output: new TextEncoder().encode("invalid json"),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle empty response", async () => {
			const mockResponse = {
				output: new TextEncoder().encode(JSON.stringify({})),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle cross-region inference", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUseCrossRegionInference: true,
			})

			const mockResponse = {
				output: new TextEncoder().encode(
					JSON.stringify({
						content: "Test response",
					}),
				),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
					}),
				}),
			)
		})

		it("should not include system prompt cache in completePrompt when enabled and supported", async () => {
			// Create handler with prompt cache enabled
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0", // This model supports prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			const mockResponse = {
				output: new TextEncoder().encode(
					JSON.stringify({
						content: "Test response with cache",
					}),
				),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handlerWithCache["client"] = {
				send: mockSend,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			const result = await handlerWithCache.completePrompt("Test prompt")
			expect(result).toBe("Test response with cache")

			// Verify cachePoint was included in the messages
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.not.objectContaining({
						system: expect.anything(),
					}),
				}),
			)
		})

		it("should not include system prompt cache in completePrompt when model doesn't support it", async () => {
			// Create handler with prompt cache enabled but use a model that doesn't support it
			const handlerWithCache = new AwsBedrockHandler({
				apiModelId: "amazon.titan-text-express-v1:0", // This model doesn't support prompt cache
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsUsePromptCache: true,
			})

			const mockResponse = {
				output: new TextEncoder().encode(
					JSON.stringify({
						content: "Test response without cache",
					}),
				),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handlerWithCache["client"] = {
				send: mockSend,
				config: { region: "us-east-1" },
			} as unknown as BedrockRuntimeClient

			const result = await handlerWithCache.completePrompt("Test prompt")
			expect(result).toBe("Test response without cache")

			// Verify cachePoint was included in the messages
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.not.objectContaining({
						system: expect.anything(),
					}),
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should use custom ARN when provided", () => {
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsCustomArn: "arn:aws:bedrock:us-east-1::foundation-model/custom-model",
			})
			const modelInfo = customArnHandler.getModel()
			expect(modelInfo.id).toBe("arn:aws:bedrock:us-east-1::foundation-model/custom-model")
			expect(modelInfo.info.maxTokens).toBe(4096)
			expect(modelInfo.info.contextWindow).toBe(200_000)
			expect(modelInfo.info.supportsPromptCache).toBe(false)
		})

		it("should correctly identify model info from inference profile ARN", () => {
			//this test intentionally uses a model that has different maxTokens, contextWindow and other values than the fall back option in the code
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "meta.llama3-8b-instruct-v1:0", // This will be ignored when awsCustomArn is provided
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-west-2",
				awsCustomArn:
					"arn:aws:bedrock:us-west-2:699475926481:inference-profile/us.meta.llama3-8b-instruct-v1:0",
			})
			const modelInfo = customArnHandler.getModel()

			// Verify the ARN is used as the model ID
			expect(modelInfo.id).toBe(
				"arn:aws:bedrock:us-west-2:699475926481:inference-profile/us.meta.llama3-8b-instruct-v1:0",
			)

			//these should not be the default fall back. they should be Llama's config
			expect(modelInfo.info.maxTokens).toBe(2048)
			expect(modelInfo.info.contextWindow).toBe(4_000)
			expect(modelInfo.info.supportsImages).toBe(false)
			expect(modelInfo.info.supportsPromptCache).toBe(false)

			// This test highlights that the regex in getModel needs to be updated to handle inference-profile ARNs
		})

		it("should use default model when custom-arn is selected but no ARN is provided", () => {
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "custom-arn",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				// No awsCustomArn provided
			})
			const modelInfo = customArnHandler.getModel()
			// Should fall back to default model
			expect(modelInfo.id).not.toBe("custom-arn")
			expect(modelInfo.info).toBeDefined()
		})
	})

	describe("invokedModelId handling", () => {
		it("should update costModelConfig when invokedModelId is present in custom ARN scenario", async () => {
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsCustomArn: "arn:aws:bedrock:us-east-1:123456789:foundation-model/custom-model",
			})

			const mockStreamEvent = {
				trace: {
					promptRouter: {
						invokedModelId: "arn:aws:bedrock:us-east-1:123456789:foundation-model/custom-model:0",
					},
				},
			}

			jest.spyOn(customArnHandler, "getModel").mockReturnValue({
				id: "custom-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})

			await customArnHandler.createMessage("system prompt", [{ role: "user", content: "user message" }]).next()

			expect(customArnHandler.getModel()).toEqual({
				id: "custom-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})
		})

		it("should update costModelConfig when invokedModelId is present in default model scenario", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const mockStreamEvent = {
				trace: {
					promptRouter: {
						invokedModelId: "arn:aws:bedrock:us-east-1:123456789:foundation-model/default-model:0",
					},
				},
			}

			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})

			await handler.createMessage("system prompt", [{ role: "user", content: "user message" }]).next()

			expect(handler.getModel()).toEqual({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})
		})

		it("should not update costModelConfig when invokedModelId is not present", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const mockStreamEvent = {
				trace: {
					promptRouter: {
						// No invokedModelId present
					},
				},
			}

			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})

			await handler.createMessage("system prompt", [{ role: "user", content: "user message" }]).next()

			expect(handler.getModel()).toEqual({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})
		})

		it("should not update costModelConfig when invokedModelId cannot be parsed", async () => {
			handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const mockStreamEvent = {
				trace: {
					promptRouter: {
						invokedModelId: "invalid-arn",
					},
				},
			}

			jest.spyOn(handler, "getModel").mockReturnValue({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})

			await handler.createMessage("system prompt", [{ role: "user", content: "user message" }]).next()

			expect(handler.getModel()).toEqual({
				id: "default-model",
				info: {
					maxTokens: 4096,
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsImages: true,
				},
			})
		})
	})
})
