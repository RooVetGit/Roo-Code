// npx vitest run api/providers/__tests__/lm-studio-timeout.spec.ts

import { LmStudioHandler } from "../lm-studio"
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

describe("LmStudioHandler timeout configuration", () => {
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
			lmStudioModelId: "llama2",
			lmStudioBaseUrl: "http://localhost:1234",
		}

		new LmStudioHandler(options)

		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
		expect(mockGetConfig).toHaveBeenCalledWith("apiRequestTimeout", 600)
		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:1234/v1",
				apiKey: "noop",
				timeout: 600000, // 600 seconds in milliseconds
			}),
		)
	})

	it("should use custom timeout when configuration is set", () => {
		mockGetConfig.mockReturnValue(1200) // 20 minutes

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
			lmStudioBaseUrl: "http://localhost:1234",
		}

		new LmStudioHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 1200000, // 1200 seconds in milliseconds
			}),
		)
	})

	it("should handle zero timeout (no timeout)", () => {
		mockGetConfig.mockReturnValue(0)

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			lmStudioModelId: "llama2",
		}

		new LmStudioHandler(options)

		expect(mockOpenAIConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 0, // No timeout
			}),
		)
	})
})
