// Mock AWS SDK credential providers
jest.mock("@aws-sdk/credential-providers", () => ({
	fromIni: jest.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
}))

// Mock VS Code API
jest.mock("vscode", () => ({
	env: {
		remoteName: "ssh-remote", // Mock that we're in a remote SSH context
	},
	window: {
		showErrorMessage: jest.fn(),
	},
}))

// Mock profile-utils
jest.mock("../../../utils/aws/profile-utils", () => ({
	isRemoteSSH: jest.fn().mockReturnValue(true),
	doesAwsProfileExist: jest.fn(),
	showRemoteProfileError: jest.fn(),
	getDetailedRemoteProfileErrorMessage: jest.fn().mockReturnValue("Detailed error message"),
}))

import { AwsBedrockHandler } from "../bedrock"
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"
import { fromIni } from "@aws-sdk/credential-providers"
import { Anthropic } from "@anthropic-ai/sdk"
import {
	isRemoteSSH,
	doesAwsProfileExist,
	showRemoteProfileError,
	getDetailedRemoteProfileErrorMessage,
} from "../../../utils/aws/profile-utils"

describe("AwsBedrockHandler with Remote SSH", () => {
	describe("constructor with AWS Profile in Remote SSH", () => {
		it("should check if profile exists when in remote SSH context", async () => {
			// Mock profile exists
			;(doesAwsProfileExist as jest.Mock).mockResolvedValue(true)

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Wait for the async check to complete
			await new Promise(process.nextTick)

			expect(isRemoteSSH).toHaveBeenCalled()
			expect(doesAwsProfileExist).toHaveBeenCalledWith("test-profile")
			expect(showRemoteProfileError).not.toHaveBeenCalled()
		})

		it("should show error when profile doesn't exist in remote SSH context", async () => {
			// Mock profile doesn't exist
			;(doesAwsProfileExist as jest.Mock).mockResolvedValue(false)

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "non-existent-profile",
			})

			// Wait for the async check to complete
			await new Promise(process.nextTick)

			expect(isRemoteSSH).toHaveBeenCalled()
			expect(doesAwsProfileExist).toHaveBeenCalledWith("non-existent-profile")
			expect(showRemoteProfileError).toHaveBeenCalledWith("non-existent-profile")
		})
	})

	describe("createMessage with AWS Profile in Remote SSH", () => {
		it("should provide detailed error message for credential errors in remote SSH context", async () => {
			// Mock profile doesn't exist
			;(doesAwsProfileExist as jest.Mock).mockResolvedValue(false)

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "non-existent-profile",
			})

			// Mock AWS SDK invoke with credential error
			const mockError = new Error("Cannot load credentials for profile 'non-existent-profile'")
			const mockInvoke = jest.fn().mockRejectedValue(mockError)

			handler["client"] = {
				send: mockInvoke,
			} as unknown as BedrockRuntimeClient

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Collect all chunks
			const chunks = []
			try {
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			} catch (error) {
				// Expected to throw after yielding chunks
			}

			// Should have yielded the detailed error message
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Detailed error message",
			})

			expect(isRemoteSSH).toHaveBeenCalled()
			expect(getDetailedRemoteProfileErrorMessage).toHaveBeenCalledWith("non-existent-profile")
		})

		it("should provide standard error message for non-credential errors", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Mock AWS SDK invoke with non-credential error
			const mockError = new Error("Connection timeout")
			const mockInvoke = jest.fn().mockRejectedValue(mockError)

			handler["client"] = {
				send: mockInvoke,
			} as unknown as BedrockRuntimeClient

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Collect all chunks
			const chunks = []
			try {
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			} catch (error) {
				// Expected to throw after yielding chunks
			}

			// Should have yielded the standard error message
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Error: Connection timeout",
			})
		})
	})

	describe("completePrompt with AWS Profile in Remote SSH", () => {
		it("should throw detailed error message for credential errors in remote SSH context", async () => {
			// Mock profile doesn't exist
			;(doesAwsProfileExist as jest.Mock).mockResolvedValue(false)

			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "non-existent-profile",
			})

			// Mock AWS SDK invoke with credential error
			const mockError = new Error("Cannot load credentials for profile 'non-existent-profile'")
			const mockSend = jest.fn().mockRejectedValue(mockError)

			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await expect(handler.completePrompt("Test prompt")).rejects.toEqual(new Error("Detailed error message"))

			expect(isRemoteSSH).toHaveBeenCalled()
			expect(getDetailedRemoteProfileErrorMessage).toHaveBeenCalledWith("non-existent-profile")
		})

		it("should throw standard error message for non-credential errors", async () => {
			const handler = new AwsBedrockHandler({
				apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				awsRegion: "us-east-1",
				awsUseProfile: true,
				awsProfile: "test-profile",
			})

			// Mock AWS SDK invoke with non-credential error
			const mockError = new Error("Connection timeout")
			const mockSend = jest.fn().mockRejectedValue(mockError)

			handler["client"] = {
				send: mockSend,
			} as unknown as BedrockRuntimeClient

			await expect(handler.completePrompt("Test prompt")).rejects.toEqual(
				new Error("Bedrock completion error: Connection timeout"),
			)
		})
	})
})
