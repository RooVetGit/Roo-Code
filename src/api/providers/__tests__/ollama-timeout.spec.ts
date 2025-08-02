// npx vitest run api/providers/__tests__/ollama-timeout.spec.ts

import { OllamaHandler } from "../ollama"
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

// Mock OpenAI
const mockOpenAIConstructor = vitest.fn()
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
	}
})

describe("OllamaHandler timeout configuration", () => {
	let mockGetConfig: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockGetConfig = vitest.fn()
		;(vscode.workspace.getConfiguration as any).mockReturnValue({
			get: mockGetConfig,
		})
	})

	it("should use default timeout of 600 seconds when no configuration is set", () => {
		mockGetConfig.mockReturnValue(600)

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434",
		}

		new OllamaHandler(options)

		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
		expect(mockGetConfig).toHaveBeenCalledWith("apiRequestTimeout", 600)
		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:11434/v1",
				apiKey: "ollama",
				timeout: 600000, // 600 seconds in milliseconds
			}),
		)
	})

	it("should use custom timeout when configuration is set", () => {
		mockGetConfig.mockReturnValue(3600) // 1 hour

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
		}

		new OllamaHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 3600000, // 3600 seconds in milliseconds
			}),
		)
	})

	it("should handle zero timeout (no timeout)", () => {
		mockGetConfig.mockReturnValue(0)

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434",
		}

		new OllamaHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 0, // No timeout
			}),
		)
	})

	it("should use default base URL when not provided", () => {
		mockGetConfig.mockReturnValue(600)

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
		}

		new OllamaHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:11434/v1",
			}),
		)
	})
})
