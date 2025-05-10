// Mock AWS SDK credential providers
jest.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = jest.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})
	return { fromIni: mockFromIni }
})

// Mock BedrockRuntimeClient and ConverseStreamCommand
const mockConverseStreamCommand = jest.fn()
const mockSend = jest.fn().mockResolvedValue({
	stream: [],
})

jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
	BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
		send: mockSend,
	})),
	ConverseStreamCommand: mockConverseStreamCommand,
	ConverseCommand: jest.fn(),
}))

import { AwsBedrockHandler } from "../bedrock"

import { Anthropic } from "@anthropic-ai/sdk"

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

	describe("getModel", () => {
		it("should return the correct model info for a standard model", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeDefined()
			expect(modelInfo.info.contextWindow).toBeDefined()
		})

		it("should use custom ARN when provided", () => {
			// This test is incompatible with the refactored implementation
			// The implementation now extracts the model ID from the ARN instead of using the ARN directly
			// We'll update the test to match the new behavior
			const customArnHandler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
				awsCustomArn: "arn:aws:bedrock:us-east-1::inference-profile/custom-model",
			})

			const modelInfo = customArnHandler.getModel()
			// Now we expect the model ID to be extracted from the ARN
			expect(modelInfo.id).toBe("arn:aws:bedrock:us-east-1::inference-profile/custom-model")
			expect(modelInfo.info).toBeDefined()
		})

		it("should handle inference-profile ARN with apne3 region prefix", () => {
			const originalParseArn = AwsBedrockHandler.prototype["parseArn"]
			const parseArnMock = jest.fn().mockImplementation(function (this: any, arn: string, region?: string) {
				return originalParseArn.call(this, arn, region)
			})
			AwsBedrockHandler.prototype["parseArn"] = parseArnMock

			try {
				const customArnHandler = new AwsBedrockHandler({
					apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
					awsAccessKey: "test-access-key",
					awsSecretKey: "test-secret-key",
					awsRegion: "ap-northeast-3",
					awsCustomArn:
						"arn:aws:bedrock:ap-northeast-3:123456789012:inference-profile/apne3.anthropic.claude-3-5-sonnet-20241022-v2:0",
				})

				const modelInfo = customArnHandler.getModel()

				expect(modelInfo.id).toBe(
					"arn:aws:bedrock:ap-northeast-3:123456789012:inference-profile/apne3.anthropic.claude-3-5-sonnet-20241022-v2:0",
				)
				expect(modelInfo.info).toBeDefined()

				expect(parseArnMock).toHaveBeenCalledWith(
					"arn:aws:bedrock:ap-northeast-3:123456789012:inference-profile/apne3.anthropic.claude-3-5-sonnet-20241022-v2:0",
					"ap-northeast-3",
				)

				expect((customArnHandler as any).arnInfo.modelId).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0")
				expect((customArnHandler as any).arnInfo.crossRegionInference).toBe(false)
			} finally {
				AwsBedrockHandler.prototype["parseArn"] = originalParseArn
			}
		})

		it("should use default prompt router model when prompt router arn is entered but no model can be identified from the ARN", () => {
			const customArnHandler = new AwsBedrockHandler({
				awsCustomArn:
					"arn:aws:bedrock:ap-northeast-3:123456789012:default-prompt-router/my_router_arn_no_model",
				awsAccessKey: "test-access-key",
				awsSecretKey: "test-secret-key",
				awsRegion: "us-east-1",
			})
			const modelInfo = customArnHandler.getModel()
			expect(modelInfo.id).toBe(
				"arn:aws:bedrock:ap-northeast-3:123456789012:default-prompt-router/my_router_arn_no_model",
			)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(4096)
		})
	})

	describe("image handling", () => {
		const mockImageData = Buffer.from("test-image-data").toString("base64")

		beforeEach(() => {
			// Reset the mocks before each test
			mockSend.mockReset()
			mockConverseStreamCommand.mockReset()

			mockSend.mockResolvedValue({
				stream: [],
			})
		})

		it("should properly convert image content to Bedrock format", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								data: mockImageData,
								media_type: "image/jpeg",
							},
						},
						{
							type: "text",
							text: "What's in this image?",
						},
					],
				},
			]

			const generator = handler.createMessage("", messages)
			await generator.next() // Start the generator

			// Verify the command was created with the right payload
			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0]

			// Verify the image was properly formatted
			const imageBlock = commandArg.messages[0].content[0]
			expect(imageBlock).toHaveProperty("image")
			expect(imageBlock.image).toHaveProperty("format", "jpeg")
			expect(imageBlock.image.source).toHaveProperty("bytes")
			expect(imageBlock.image.source.bytes).toBeInstanceOf(Uint8Array)
		})

		it("should reject unsupported image formats", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								data: mockImageData,
								media_type: "image/tiff" as "image/jpeg", // Type assertion to bypass TS
							},
						},
					],
				},
			]

			const generator = handler.createMessage("", messages)
			await expect(generator.next()).rejects.toThrow("Unsupported image format: tiff")
		})

		it("should handle multiple images in a single message", async () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								data: mockImageData,
								media_type: "image/jpeg",
							},
						},
						{
							type: "text",
							text: "First image",
						},
						{
							type: "image",
							source: {
								type: "base64",
								data: mockImageData,
								media_type: "image/png",
							},
						},
						{
							type: "text",
							text: "Second image",
						},
					],
				},
			]

			const generator = handler.createMessage("", messages)
			await generator.next() // Start the generator

			// Verify the command was created with the right payload
			expect(mockConverseStreamCommand).toHaveBeenCalled()
			const commandArg = mockConverseStreamCommand.mock.calls[0][0]

			// Verify both images were properly formatted
			const firstImage = commandArg.messages[0].content[0]
			const secondImage = commandArg.messages[0].content[2]

			expect(firstImage).toHaveProperty("image")
			expect(firstImage.image).toHaveProperty("format", "jpeg")
			expect(secondImage).toHaveProperty("image")
			expect(secondImage.image).toHaveProperty("format", "png")
		})
	})

	describe("prompt caching", () => {
		// Access the private convertToBedrockConverseMessages method for testing
		const getPrivateMethod = (handler: AwsBedrockHandler) => {
			return (handler as any).convertToBedrockConverseMessages.bind(handler)
		}

		it("should not add cache points when prompt caching is disabled", () => {
			const convertToBedrockConverseMessages = getPrivateMethod(handler)

			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
				{ role: "user", content: "How are you?" },
			]

			const systemPrompt = "You are a helpful assistant."
			const result = convertToBedrockConverseMessages(messages, systemPrompt, false)

			// Verify no cache points were added
			expect(result.system[0]).not.toHaveProperty("cachePoint")
			result.messages.forEach((msg: any) => {
				expect(msg.content).not.toContainEqual(expect.objectContaining({ cachePoint: expect.anything() }))
			})
		})

		it("should add cache point to first message when system prompt is present", () => {
			const convertToBedrockConverseMessages = getPrivateMethod(handler)

			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
				{ role: "user", content: "How are you?" },
			]

			const systemPrompt = "You are a helpful assistant."
			const result = convertToBedrockConverseMessages(messages, systemPrompt, true)

			// Verify cache point was added to first message
			const firstMessage = result.messages[0]
			const hasCachePoint = firstMessage.content.some(
				(item: any) => item.cachePoint && item.cachePoint.type === "default",
			)
			expect(hasCachePoint).toBe(true)
		})

		it("should add cache points to last and second-to-last user messages", () => {
			const convertToBedrockConverseMessages = getPrivateMethod(handler)

			const messages = [
				{ role: "user", content: "First user message" },
				{ role: "assistant", content: "First assistant response" },
				{ role: "user", content: "Second user message" },
				{ role: "assistant", content: "Second assistant response" },
				{ role: "user", content: "Third user message" },
			]

			const result = convertToBedrockConverseMessages(messages, undefined, true)

			// Find indices of user messages
			const userMessageIndices = messages
				.map((msg, idx) => (msg.role === "user" ? idx : -1))
				.filter((idx) => idx !== -1)

			const lastUserIndex = userMessageIndices[userMessageIndices.length - 1]
			const secondLastUserIndex = userMessageIndices[userMessageIndices.length - 2]

			// Verify cache points were added to last and second-to-last user messages
			const lastUserMessage = result.messages[lastUserIndex]
			const secondLastUserMessage = result.messages[secondLastUserIndex]

			const lastUserHasCachePoint = lastUserMessage.content.some(
				(item: any) => item.cachePoint && item.cachePoint.type === "default",
			)
			const secondLastUserHasCachePoint = secondLastUserMessage.content.some(
				(item: any) => item.cachePoint && item.cachePoint.type === "default",
			)

			expect(lastUserHasCachePoint).toBe(true)
			expect(secondLastUserHasCachePoint).toBe(true)

			// Verify other messages don't have cache points
			const otherMessages = result.messages.filter(
				(_: any, idx: number) => idx !== lastUserIndex && idx !== secondLastUserIndex && idx !== 0,
			)

			otherMessages.forEach((msg: any) => {
				const hasCachePoint = msg.content.some((item: any) => item.cachePoint)
				expect(hasCachePoint).toBe(false)
			})
		})

		it("should handle conversation with only one user message", () => {
			const convertToBedrockConverseMessages = getPrivateMethod(handler)

			const messages = [{ role: "user", content: "Single user message" }]

			const result = convertToBedrockConverseMessages(messages, undefined, true)

			// Verify cache point was added to the only user message
			const userMessage = result.messages[0]
			const hasCachePoint = userMessage.content.some(
				(item: any) => item.cachePoint && item.cachePoint.type === "default",
			)

			expect(hasCachePoint).toBe(true)
		})

		it("should handle empty messages array", () => {
			const convertToBedrockConverseMessages = getPrivateMethod(handler)

			const messages: Anthropic.Messages.MessageParam[] = []

			const result = convertToBedrockConverseMessages(messages, undefined, true)

			// Verify no errors and empty messages array
			expect(result.messages).toEqual([])
		})
	})

	describe("cache token reporting", () => {
		it("should handle all cache token field naming conventions", async () => {
			// Mock the stream to include various cache token field names
			mockSend.mockResolvedValue({
				stream: [
					{
						metadata: {
							usage: {
								inputTokens: 100,
								outputTokens: 50,
								cacheReadInputTokens: 30,
							},
						},
					},
					{
						metadata: {
							usage: {
								inputTokens: 0,
								outputTokens: 10,
								cacheWriteInputTokenCount: 20,
							},
						},
					},
					{
						metadata: {
							usage: {
								inputTokens: 0,
								outputTokens: 5,
								cacheReadTokens: 15,
							},
						},
					},
					{
						metadata: {
							usage: {
								inputTokens: 0,
								outputTokens: 5,
								cacheWriteTokens: 25,
							},
						},
					},
				],
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message" }]
			const generator = handler.createMessage("Test system prompt", messages)

			// Collect all yielded values
			const results: any[] = []
			for await (const result of generator) {
				results.push(result)
			}

			// Verify all cache token field naming conventions were handled
			expect(results).toContainEqual({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 30,
				cacheWriteTokens: 0,
			})

			expect(results).toContainEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 10,
				cacheReadTokens: 0,
				cacheWriteTokens: 20,
			})

			expect(results).toContainEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 5,
				cacheReadTokens: 15,
				cacheWriteTokens: 0,
			})

			expect(results).toContainEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 5,
				cacheReadTokens: 0,
				cacheWriteTokens: 25,
			})
		})
	})
})
