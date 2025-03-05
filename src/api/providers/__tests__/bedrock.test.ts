// Mock AWS SDK credential providers
jest.mock("@aws-sdk/credential-providers", () => ({
	fromIni: jest.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
	fromSSO: jest.fn().mockReturnValue({
		accessKeyId: "sso-access-key",
		secretAccessKey: "sso-secret-key",
	}),
}))

import { AwsBedrockHandler } from "../bedrock"
import { MessageContent } from "../../../shared/api"
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"
import { Anthropic } from "@anthropic-ai/sdk"
import { fromIni, fromSSO } from "@aws-sdk/credential-providers"

describe("AwsBedrockHandler", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
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

		it("should initialize with AWS SSO credentials", () => {
			const handlerWithSSO = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
				awsProfile: "test-sso-profile",
			})
			expect(handlerWithSSO).toBeInstanceOf(AwsBedrockHandler)
			expect(handlerWithSSO["options"].awsUseSso).toBe(true)
			expect(handlerWithSSO["options"].awsProfile).toBe("test-sso-profile")
		})

		it("should initialize with AWS SSO enabled but no profile set", () => {
			const handlerWithoutSSOProfile = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
			})
			expect(handlerWithoutSSOProfile).toBeInstanceOf(AwsBedrockHandler)
			expect(handlerWithoutSSOProfile["options"].awsUseSso).toBe(true)
			expect(handlerWithoutSSOProfile["options"].awsProfile).toBeUndefined()
		})
	})

	describe("AWS SDK client configuration", () => {
		beforeEach(() => {
			// Reset mocks before each test
			jest.clearAllMocks()
		})

		it("should configure client with profile credentials when profile mode is enabled", async () => {
			const handlerWithProfile = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Mock a simple API call to verify credentials are used
			const mockResponse = {
				output: new TextEncoder().encode(JSON.stringify({ content: "test" })),
			}
			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handlerWithProfile["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await handlerWithProfile.completePrompt("test")

			// Verify the client was configured with profile credentials
			expect(mockSend).toHaveBeenCalled()
			expect(fromIni).toHaveBeenCalledWith({
				profile: "test-profile",
			})
		})

		it("should configure client with SSO credentials when SSO mode is enabled", async () => {
			const handlerWithSSO = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
				awsProfile: "test-sso-profile",
			})

			// Mock a simple API call to verify credentials are used
			const mockResponse = {
				output: new TextEncoder().encode(JSON.stringify({ content: "test" })),
			}
			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handlerWithSSO["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await handlerWithSSO.completePrompt("test")

			// Verify the client was configured with SSO credentials
			expect(mockSend).toHaveBeenCalled()
			expect(fromSSO).toHaveBeenCalledWith({
				profile: "test-sso-profile",
			})
		})

		it("should prioritize SSO over profile when both are enabled", async () => {
			const handlerWithBoth = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Mock a simple API call to verify credentials are used
			const mockResponse = {
				output: new TextEncoder().encode(JSON.stringify({ content: "test" })),
			}
			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			handlerWithBoth["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await handlerWithBoth.completePrompt("test")

			// Verify the client was configured with SSO credentials (not profile)
			expect(mockSend).toHaveBeenCalled()
			expect(fromSSO).toHaveBeenCalledWith({
				profile: "test-profile",
			})
			// fromIni should not be called
			expect(fromIni).not.toHaveBeenCalled()
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
					input_tokens: 10,
					output_tokens: 5,
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
			})

			expect(mockInvoke).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					}),
				}),
			)
		})

		it("should handle inference profile ARNs correctly in createMessage", async () => {
			// Create a handler with an ARN as the model ID
			const arnHandler = new AwsBedrockHandler({
				apiModelId: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

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

			arnHandler["client"] = {
				send: mockInvoke,
			} as unknown as BedrockRuntimeClient

			const stream = arnHandler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that the ARN is used directly without modification
			expect(mockInvoke).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile",
					}),
				}),
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
	})

	describe("credential refresh functionality", () => {
		it("should refresh client and retry when SSO session expires", async () => {
			// Create a handler with SSO auth
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
				awsProfile: "test-profile",
			})

			// Create a spy for the refreshClient method but don't actually call it
			const refreshClientSpy = jest.spyOn(handler as any, "refreshClient").mockImplementation(() => {
				// Do nothing - we're just testing if it gets called
			})

			// Mock the client.send method to fail with an SSO error on first call, then succeed on second call
			let callCount = 0
			const mockSend = jest.fn().mockImplementation(() => {
				if (callCount === 0) {
					callCount++
					throw new Error("The SSO session associated with this profile has expired")
				}
				return {
					output: new TextEncoder().encode(JSON.stringify({ content: "Success after refresh" })),
				}
			})

			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			// Call completePrompt
			const result = await handler.completePrompt("Test prompt")

			// Verify that refreshClient was called
			expect(refreshClientSpy).toHaveBeenCalledTimes(1)

			// Verify that send was called twice (once before refresh, once after)
			expect(mockSend).toHaveBeenCalledTimes(2)

			// Verify the result
			expect(result).toBe("Success after refresh")
		})

		it("should refresh client and retry when createMessage encounters SSO session expiration", async () => {
			// Create a handler with SSO auth
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseSso: true,
				awsProfile: "test-profile",
			})

			// Create a spy for the refreshClient method but don't actually call it
			const refreshClientSpy = jest.spyOn(handler as any, "refreshClient").mockImplementation(() => {
				// Do nothing - we're just testing if it gets called
			})

			// Mock the client.send method to fail with an SSO error on first call, then succeed on second call
			let callCount = 0
			const mockSend = jest.fn().mockImplementation(() => {
				if (callCount === 0) {
					callCount++
					throw new Error("The SSO session associated with this profile has expired")
				}
				return {
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
				}
			})

			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			// Call createMessage
			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that refreshClient was called
			expect(refreshClientSpy).toHaveBeenCalledTimes(1)

			// Verify that send was called twice (once before refresh, once after)
			expect(mockSend).toHaveBeenCalledTimes(2)

			// Verify the result
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
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

		it("should handle inference profile ARNs correctly", async () => {
			// Create a handler with an ARN as the model ID
			const arnHandler = new AwsBedrockHandler({
				apiModelId: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})

			const mockResponse = {
				output: new TextEncoder().encode(
					JSON.stringify({
						content: "Test response",
					}),
				),
			}

			const mockSend = jest.fn().mockResolvedValue(mockResponse)
			arnHandler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			const result = await arnHandler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			// Verify that the ARN is used directly without modification
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						modelId: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile",
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
	})

	describe("getModel", () => {
		it("should return correct model info in test environment", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(5000) // Test environment value
			expect(modelInfo.info.contextWindow).toBe(128_000) // Test environment value
		})

		it("should return test model info for invalid model in test environment", () => {
			const invalidHandler = new AwsBedrockHandler({
				apiModelId: "invalid-model",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})
			const modelInfo = invalidHandler.getModel()
			expect(modelInfo.id).toBe("invalid-model") // In test env, returns whatever is passed
			expect(modelInfo.info.maxTokens).toBe(5000)
			expect(modelInfo.info.contextWindow).toBe(128_000)
		})

		it("should handle inference profile ARNs correctly in getModel", () => {
			const arnHandler = new AwsBedrockHandler({
				apiModelId: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})
			const modelInfo = arnHandler.getModel()

			// Verify that the ARN is returned as-is
			expect(modelInfo.id).toBe("arn:aws:bedrock:us-east-1:123456789012:inference-profile/my-claude-profile")

			// In test environment, it should still have the test model info
			expect(modelInfo.info.maxTokens).toBe(5000)
			expect(modelInfo.info.contextWindow).toBe(128_000)
		})
	})
})
