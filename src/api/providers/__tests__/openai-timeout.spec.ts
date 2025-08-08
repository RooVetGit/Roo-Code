// npx vitest run api/providers/__tests__/openai-timeout.spec.ts

import { OpenAiHandler } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"
import * as vscode from "vscode"

// Mock vscode
vitest.mock("vscode", () => ({
	workspace: {
		getConfiguration: vitest.fn().mockReturnValue({
			get: vitest.fn(),
		}),
	},
}))

// Mock OpenAI and AzureOpenAI
const mockOpenAIConstructor = vitest.fn()
const mockAzureOpenAIConstructor = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation((config) => {
			mockOpenAIConstructor(config)
			return {
				chat: {
					completions: {
						create: vitest.fn(),
					},
				},
			}
		}),
		AzureOpenAI: vitest.fn().mockImplementation((config) => {
			mockAzureOpenAIConstructor(config)
			return {
				chat: {
					completions: {
						create: vitest.fn(),
					},
				},
			}
		}),
	}
})

describe("OpenAiHandler timeout configuration", () => {
	let mockGetConfig: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockGetConfig = vitest.fn()
		;(vscode.workspace.getConfiguration as any).mockReturnValue({
			get: mockGetConfig,
		})
	})

	it("should use default timeout for standard OpenAI", () => {
		mockGetConfig.mockReturnValue(600)

		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
		expect(mockGetConfig).toHaveBeenCalledWith("apiRequestTimeout", 600)
		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.openai.com/v1",
				apiKey: "test-key",
				timeout: 600000, // 600 seconds in milliseconds
			}),
		)
	})

	it("should use custom timeout for OpenAI-compatible providers", () => {
		mockGetConfig.mockReturnValue(1800) // 30 minutes

		const options: ApiHandlerOptions = {
			apiModelId: "custom-model",
			openAiModelId: "custom-model",
			openAiBaseUrl: "http://localhost:8080/v1",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:8080/v1",
				timeout: 1800000, // 1800 seconds in milliseconds
			}),
		)
	})

	it("should use timeout for Azure OpenAI", () => {
		mockGetConfig.mockReturnValue(900) // 15 minutes

		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://myinstance.openai.azure.com",
			openAiApiKey: "test-key",
			openAiUseAzure: true,
		}

		new OpenAiHandler(options)

		expect(mockAzureOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 900000, // 900 seconds in milliseconds
			}),
		)
	})

	it("should use timeout for Azure AI Inference", () => {
		mockGetConfig.mockReturnValue(1200) // 20 minutes

		const options: ApiHandlerOptions = {
			apiModelId: "deepseek",
			openAiModelId: "deepseek",
			openAiBaseUrl: "https://myinstance.services.ai.azure.com",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 1200000, // 1200 seconds in milliseconds
			}),
		)
	})

	it("should handle zero timeout (no timeout)", () => {
		mockGetConfig.mockReturnValue(0)

		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
		}

		new OpenAiHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 0, // No timeout
			}),
		)
	})
})
