import { AwsBedrockHandler } from "../bedrock"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the logger
jest.mock("../../../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		fatal: jest.fn(),
		child: jest.fn().mockReturnValue({
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			fatal: jest.fn(),
		}),
	},
}))

jest.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockModule = {
		lastCommandInput: null as Record<string, any> | null,
		mockSend: jest.fn().mockImplementation(async function () {
			return {
				output: new TextEncoder().encode(JSON.stringify({ content: "Test response" })),
			}
		}),
		mockConverseCommand: jest.fn(function (input) {
			mockModule.lastCommandInput = input
			return { input }
		}),
		MockBedrockRuntimeClient: class {
			public config: any
			public send: jest.Mock

			constructor(config: { region?: string }) {
				this.config = config
				this.send = mockModule.mockSend
			}
		},
	}

	return {
		BedrockRuntimeClient: mockModule.MockBedrockRuntimeClient,
		ConverseCommand: mockModule.mockConverseCommand,
		ConverseStreamCommand: jest.fn(),
		__mock: mockModule, // Expose mock internals for testing
	}
})

// Get mock module for testing
const bedrockMock = jest.requireMock("@aws-sdk/client-bedrock-runtime").__mock

describe("AwsBedrockHandler with custom ARN", () => {
	const mockOptions: ApiHandlerOptions = {
		apiModelId: "custom-arn",
		awsCustomArn: "arn:aws:bedrock:us-east-1:123456789012:foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
		awsRegion: "us-east-1",
		awsUseProfile: true,
		awsProfile: "default",
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should use the custom ARN as the model ID", async () => {
		const handler = new AwsBedrockHandler(mockOptions)
		const model = handler.getModel()

		expect(model.id).toBe(mockOptions.awsCustomArn)
		expect(model.info).toHaveProperty("maxTokens")
		expect(model.info).toHaveProperty("contextWindow")
		expect(model.info).toHaveProperty("supportsPromptCache")
	})

	it("should extract region from ARN and use it for client configuration", () => {
		// Test with ARN in eu-west-1 but config region in us-east-1
		const euWestOptions = {
			...mockOptions,
			awsRegion: "us-east-1",
			awsCustomArn:
				"arn:aws:bedrock:eu-west-1:123456789012:foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
		}

		const handler = new AwsBedrockHandler(euWestOptions)
		expect((handler as any).client.config.region).toBe("eu-west-1")
	})

	it("should validate ARN format", async () => {
		// Invalid ARN format
		const invalidOptions = {
			...mockOptions,
			awsCustomArn: "invalid-arn-format",
		}

		const handler = new AwsBedrockHandler(invalidOptions)

		try {
			await handler.completePrompt("test")
		} catch (error) {
			// Expected error
		}

		// completePrompt should throw an error for invalid ARN
		await expect(handler.completePrompt("test")).rejects.toThrow("Invalid ARN format")
	})
})
