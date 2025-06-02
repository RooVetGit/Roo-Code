import { renderHook } from "@testing-library/react"
import { useSelectedModel } from "../useSelectedModel"
import type { ProviderSettings } from "@roo-code/types"

// Mock the useRouterModels hook
jest.mock("../useRouterModels", () => ({
	useRouterModels: () => ({
		data: {
			openrouter: {},
			requesty: {},
			glama: {},
			unbound: {},
			litellm: {},
			modelharbor: {
				"qwen/qwen3-32b": {
					maxTokens: 8192,
					contextWindow: 40960,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.15,
					outputPrice: 0.6,
					description:
						"Qwen3-32B is a powerful large language model with excellent performance across various tasks including reasoning, coding, and creative writing.",
				},
				"qwen/qwen2.5-coder-32b": {
					maxTokens: 8192,
					contextWindow: 131072,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.1,
					outputPrice: 0.3,
					description:
						"Qwen2.5-Coder-32B is a powerful coding-focused model with excellent performance in code generation and understanding.",
				},
				"openai/gpt-4.1": {
					maxTokens: 16384,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 0.0002,
					outputPrice: 0.0008,
					description: "OpenAI GPT-4.1 with vision support and advanced function calling capabilities.",
				},
			},
		},
		isLoading: false,
		isError: false,
	}),
}))

// Mock the useOpenRouterModelProviders hook
jest.mock("../useOpenRouterModelProviders", () => ({
	useOpenRouterModelProviders: () => ({
		data: {},
		isLoading: false,
		isError: false,
	}),
}))

describe("useSelectedModel - ModelHarbor", () => {
	it("should return default model when no modelharborModelId is specified", () => {
		const apiConfiguration: ProviderSettings = {
			apiProvider: "modelharbor",
		}

		const { result } = renderHook(() => useSelectedModel(apiConfiguration))

		expect(result.current.id).toBe("qwen/qwen3-32b")
		expect(result.current.info).toBeDefined()
		expect(result.current.info?.maxTokens).toBe(8192)
		expect(result.current.info?.contextWindow).toBe(40960)
	})

	it("should return selected model when modelharborModelId is specified", () => {
		const apiConfiguration: ProviderSettings = {
			apiProvider: "modelharbor",
			modelharborModelId: "qwen/qwen2.5-coder-32b",
		}

		const { result } = renderHook(() => useSelectedModel(apiConfiguration))

		expect(result.current.id).toBe("qwen/qwen2.5-coder-32b")
		expect(result.current.info).toBeDefined()
		expect(result.current.info?.maxTokens).toBe(8192)
		expect(result.current.info?.contextWindow).toBe(131072)
	})

	it("should return OpenAI model when specified", () => {
		const apiConfiguration: ProviderSettings = {
			apiProvider: "modelharbor",
			modelharborModelId: "openai/gpt-4.1",
		}

		const { result } = renderHook(() => useSelectedModel(apiConfiguration))

		expect(result.current.id).toBe("openai/gpt-4.1")
		expect(result.current.info).toBeDefined()
		expect(result.current.info?.maxTokens).toBe(16384)
		expect(result.current.info?.contextWindow).toBe(128000)
	})

	it("should fallback to default when invalid model is specified", () => {
		const apiConfiguration: ProviderSettings = {
			apiProvider: "modelharbor",
			modelharborModelId: "invalid/model",
		}

		const { result } = renderHook(() => useSelectedModel(apiConfiguration))

		expect(result.current.id).toBe("qwen/qwen3-32b")
		expect(result.current.info).toBeDefined()
		expect(result.current.info?.maxTokens).toBe(8192)
	})

	it("should have correct provider name", () => {
		const apiConfiguration: ProviderSettings = {
			apiProvider: "modelharbor",
		}

		const { result } = renderHook(() => useSelectedModel(apiConfiguration))

		expect(result.current.provider).toBe("modelharbor")
	})
})
