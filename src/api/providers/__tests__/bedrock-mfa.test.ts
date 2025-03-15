import { AwsBedrockHandler } from "../bedrock"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the AWS SDK
jest.mock("@aws-sdk/client-bedrock-runtime", () => {
	const mockSend = jest.fn().mockImplementation(() => {
		return {
			output: new TextEncoder().encode(
				JSON.stringify({
					content: "Test response",
				}),
			),
		}
	})

	return {
		BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
			send: mockSend,
			config: {
				region: "us-east-1",
			},
		})),
		ConverseCommand: jest.fn(),
		ConverseStreamCommand: jest.fn(),
	}
})

// Mock the AWS STS SDK
jest.mock("@aws-sdk/client-sts", () => {
	const mockSend = jest.fn().mockImplementation(() => {
		return {
			Credentials: {
				AccessKeyId: "TEMP_ACCESS_KEY",
				SecretAccessKey: "TEMP_SECRET_KEY",
				SessionToken: "TEMP_SESSION_TOKEN",
				Expiration: new Date(Date.now() + 3600 * 1000), // 1 hour from now
			},
		}
	})

	return {
		STSClient: jest.fn().mockImplementation(() => ({
			send: mockSend,
		})),
		GetSessionTokenCommand: jest.fn(),
	}
})

// Mock the AWS SDK credential providers
jest.mock("@aws-sdk/credential-providers", () => ({
	fromIni: jest.fn().mockReturnValue({
		accessKeyId: "PROFILE_ACCESS_KEY",
		secretAccessKey: "PROFILE_SECRET_KEY",
	}),
}))

// Mock vscode
jest.mock("vscode", () => ({
	window: {
		showInputBox: jest.fn().mockResolvedValue("123456"),
	},
}))

describe("AwsBedrockHandler with MFA", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should initialize with MFA credentials when awsUseMfa is true", async () => {
		const options: ApiHandlerOptions = {
			awsAccessKey: "ACCESS_KEY",
			awsSecretKey: "SECRET_KEY",
			awsUseMfa: true,
			awsMfaDevice: "arn:aws:iam::123456789012:mfa/user",
			awsRegion: "us-east-1",
		}

		const handler = new AwsBedrockHandler(options)
		
		// Verify that the initial Bedrock client was created with the basic credentials
		expect(require("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient).toHaveBeenCalledWith(
			expect.objectContaining({
				region: "us-east-1",
				credentials: {
					accessKeyId: "ACCESS_KEY",
					secretAccessKey: "SECRET_KEY",
				},
			})
		)
		
		// Wait for the async MFA credentials update to complete
		await new Promise(resolve => setTimeout(resolve, 10))
		
		// Verify that the STS client was created with the correct parameters
		expect(require("@aws-sdk/client-sts").STSClient).toHaveBeenCalledWith({
			region: "us-east-1",
			credentials: {
				accessKeyId: "ACCESS_KEY",
				secretAccessKey: "SECRET_KEY",
			},
		})

		// Verify that GetSessionTokenCommand was called with the correct parameters
		expect(require("@aws-sdk/client-sts").GetSessionTokenCommand).toHaveBeenCalledWith({
			DurationSeconds: 3600,
			SerialNumber: "arn:aws:iam::123456789012:mfa/user",
			TokenCode: "123456",
		})

		// Verify that the Bedrock client was updated with the temporary credentials
		expect(require("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient).toHaveBeenCalledWith(
			expect.objectContaining({
				region: "us-east-1",
				credentials: {
					accessKeyId: "TEMP_ACCESS_KEY",
					secretAccessKey: "TEMP_SECRET_KEY",
					sessionToken: "TEMP_SESSION_TOKEN",
				},
			})
		)
	})

	it("should fall back to direct credentials if MFA fails", async () => {
		// Mock the showInputBox to return null (user cancelled)
		require("vscode").window.showInputBox.mockResolvedValueOnce(null)

		const options: ApiHandlerOptions = {
			awsAccessKey: "ACCESS_KEY",
			awsSecretKey: "SECRET_KEY",
			awsUseMfa: true,
			awsMfaDevice: "arn:aws:iam::123456789012:mfa/user",
			awsRegion: "us-east-1",
		}

		const handler = new AwsBedrockHandler(options)

		// Verify that the initial Bedrock client was created with the basic credentials
		expect(require("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient).toHaveBeenCalledWith(
			expect.objectContaining({
				region: "us-east-1",
				credentials: {
					accessKeyId: "ACCESS_KEY",
					secretAccessKey: "SECRET_KEY",
				},
			})
		)
		
		// Wait for the async MFA credentials update to complete
		await new Promise(resolve => setTimeout(resolve, 10))
		
		// Verify that the STS client was not created since the MFA code prompt was cancelled
		expect(require("@aws-sdk/client-sts").STSClient).not.toHaveBeenCalled()
		
		// Verify that the Bedrock client was not updated with temporary credentials
		expect(require("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient).toHaveBeenCalledTimes(1)
	})

	it("should use profile credentials when awsUseProfile is true", async () => {
		const options: ApiHandlerOptions = {
			awsUseProfile: true,
			awsProfile: "default",
			awsRegion: "us-east-1",
		}

		const handler = new AwsBedrockHandler(options)

		// Verify that fromIni was called with the correct parameters
		expect(require("@aws-sdk/credential-providers").fromIni).toHaveBeenCalledWith({
			profile: "default",
		})

		// Verify that the Bedrock client was created with the profile credentials
		expect(require("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient).toHaveBeenCalledWith(
			expect.objectContaining({
				region: "us-east-1",
				credentials: {
					accessKeyId: "PROFILE_ACCESS_KEY",
					secretAccessKey: "PROFILE_SECRET_KEY",
				},
			})
		)
	})
})