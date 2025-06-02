// npx jest src/api/providers/fetchers/__tests__/modelharbor.test.ts

import { getModelHarborModels } from "../modelharbor"

// Mock fetch globally
global.fetch = jest.fn()

describe("getModelHarborModels", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		// Reset console.error mock
		jest.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it("fetches and transforms ModelHarbor models correctly", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "qwen/qwen2.5-coder-32b",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "openai/Qwen/Qwen2.5-Coder-32B-Instruct",
					},
					model_info: {
						input_cost_per_token: 6e-8,
						output_cost_per_token: 1.8e-7,
						max_input_tokens: 131072,
						max_output_tokens: 8192,
						max_tokens: 8192,
						supports_vision: false,
						supports_function_calling: false,
						supports_tool_choice: false,
						supports_assistant_prefill: false,
						supports_prompt_caching: false,
						supports_audio_input: false,
						supports_audio_output: false,
						supports_pdf_input: false,
						supports_embedding_image_input: false,
						supports_web_search: false,
						supports_reasoning: false,
						supports_computer_use: false,
						supported_openai_params: [
							"frequency_penalty",
							"logit_bias",
							"logprobs",
							"top_logprobs",
							"max_tokens",
							"max_completion_tokens",
							"modalities",
							"prediction",
							"n",
							"presence_penalty",
							"seed",
							"stop",
							"stream",
							"stream_options",
							"temperature",
							"top_p",
							"tools",
							"tool_choice",
							"function_call",
							"functions",
							"max_retries",
							"extra_headers",
							"parallel_tool_calls",
							"audio",
							"web_search_options",
							"response_format",
						],
					},
				},
				{
					model_name: "qwen/qwen3-32b",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "openai/Qwen/Qwen3-32B",
					},
					model_info: {
						input_cost_per_token: 1.5e-7,
						output_cost_per_token: 6e-7,
						max_input_tokens: 40960,
						max_output_tokens: 8192,
						max_tokens: 8192,
						supports_vision: false,
						supports_function_calling: false,
						supports_tool_choice: false,
						supports_assistant_prefill: false,
						supports_prompt_caching: false,
						supports_audio_input: false,
						supports_audio_output: false,
						supports_pdf_input: false,
						supports_embedding_image_input: false,
						supports_web_search: false,
						supports_reasoning: false,
						supports_computer_use: false,
						supported_openai_params: [
							"frequency_penalty",
							"logit_bias",
							"logprobs",
							"top_logprobs",
							"max_tokens",
							"max_completion_tokens",
							"modalities",
							"prediction",
							"n",
							"presence_penalty",
							"seed",
							"stop",
							"stream",
							"stream_options",
							"temperature",
							"top_p",
							"tools",
							"tool_choice",
							"function_call",
							"functions",
							"max_retries",
							"extra_headers",
							"parallel_tool_calls",
							"audio",
							"web_search_options",
							"response_format",
						],
					},
				},
				{
					model_name: "qwen/qwen3-32b-fast",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "openai/Qwen/Qwen3-32B-fast",
						weight: 1,
					},
					model_info: {
						input_cost_per_token: 3e-7,
						output_cost_per_token: 9e-7,
						max_input_tokens: 40960,
						max_output_tokens: 8192,
						max_tokens: 8192,
						supports_vision: false,
						supports_function_calling: false,
						supports_tool_choice: false,
						supports_assistant_prefill: false,
						supports_prompt_caching: false,
						supports_audio_input: false,
						supports_audio_output: false,
						supports_pdf_input: false,
						supports_embedding_image_input: false,
						supports_web_search: false,
						supports_reasoning: false,
						supports_computer_use: false,
						supported_openai_params: [
							"frequency_penalty",
							"logit_bias",
							"logprobs",
							"top_logprobs",
							"max_tokens",
							"max_completion_tokens",
							"modalities",
							"prediction",
							"n",
							"presence_penalty",
							"seed",
							"stop",
							"stream",
							"stream_options",
							"temperature",
							"top_p",
							"tools",
							"tool_choice",
							"function_call",
							"functions",
							"max_retries",
							"extra_headers",
							"parallel_tool_calls",
							"audio",
							"web_search_options",
							"response_format",
						],
					},
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		expect(fetch).toHaveBeenCalledWith("https://api.modelharbor.com/v1/model/info")

		expect(result).toEqual({
			"qwen/qwen2.5-coder-32b": {
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				supportsReasoningEffort: false,
				inputPrice: 0.06,
				outputPrice: 0.18,
				cacheReadsPrice: 0,
				description: "qwen/qwen2.5-coder-32b - chat model with 131072 input tokens",
			},
			"qwen/qwen3-32b": {
				maxTokens: 8192,
				contextWindow: 40960,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				supportsReasoningEffort: false,
				inputPrice: 0.15,
				outputPrice: 0.6,
				cacheReadsPrice: 0,
				description: "qwen/qwen3-32b - chat model with 40960 input tokens",
			},
			"qwen/qwen3-32b-fast": {
				maxTokens: 8192,
				contextWindow: 40960,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				supportsReasoningEffort: false,
				inputPrice: 0.3,
				outputPrice: 0.9,
				cacheReadsPrice: 0,
				description: "qwen/qwen3-32b-fast - chat model with 40960 input tokens",
			},
		})
	})

	it("handles duplicate model names by keeping first occurrence", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "qwen/qwen3-32b",
					litellm_params: {
						model: "openai/Qwen/Qwen3-32B",
					},
					model_info: {
						input_cost_per_token: 1.5e-7,
						output_cost_per_token: 6e-7,
						max_input_tokens: 40960,
						max_output_tokens: 8192,
						max_tokens: 8192,
						supports_vision: false,
						supports_function_calling: false,
						supports_tool_choice: false,
						supports_assistant_prefill: false,
						supports_prompt_caching: false,
						supports_audio_input: false,
						supports_audio_output: false,
						supports_pdf_input: false,
						supports_embedding_image_input: false,
						supports_web_search: false,
						supports_reasoning: false,
						supports_computer_use: false,
					},
				},
				{
					model_name: "qwen/qwen3-32b", // Duplicate
					litellm_params: {
						model: "openai/qwen3-32b-duplicate",
					},
					model_info: {
						input_cost_per_token: 2e-7, // Different price
						output_cost_per_token: 8e-7,
						max_input_tokens: 32768,
						max_output_tokens: 7000,
						max_tokens: 7000,
						supports_vision: false,
						supports_function_calling: false,
						supports_prompt_caching: false,
						supports_computer_use: false,
					},
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		// Should only have one entry for qwen/qwen3-32b with the first model's data
		expect(Object.keys(result)).toHaveLength(1)
		expect(result["qwen/qwen3-32b"]).toEqual({
			maxTokens: 8192,
			contextWindow: 40960,
			supportsImages: false,
			supportsComputerUse: false,
			supportsPromptCache: false,
			supportsReasoningBudget: false,
			requiredReasoningBudget: false,
			supportsReasoningEffort: false,
			inputPrice: 0.15,
			outputPrice: 0.6,
			cacheReadsPrice: 0,
			description: "qwen/qwen3-32b - chat model with 40960 input tokens",
		})
	})

	it("handles models with missing optional fields", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "basic-model",
					litellm_params: {
						model: "basic-model",
					},
					model_info: {
						// Minimal fields only
						mode: "chat",
					},
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		expect(result["basic-model"]).toEqual({
			maxTokens: 8192, // Default fallback
			contextWindow: 40960, // Default fallback
			supportsImages: false,
			supportsComputerUse: false,
			supportsPromptCache: false,
			supportsReasoningBudget: false,
			requiredReasoningBudget: false,
			supportsReasoningEffort: false,
			inputPrice: 0, // No pricing info
			outputPrice: 0,
			cacheReadsPrice: 0,
			description: "basic-model - chat model with unknown input tokens",
		})
	})

	it("sorts models alphabetically", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "zebra-model",
					litellm_params: { model: "zebra-model" },
					model_info: { mode: "chat" },
				},
				{
					model_name: "alpha-model",
					litellm_params: { model: "alpha-model" },
					model_info: { mode: "chat" },
				},
				{
					model_name: "beta-model",
					litellm_params: { model: "beta-model" },
					model_info: { mode: "chat" },
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()
		const modelNames = Object.keys(result)

		expect(modelNames).toEqual(["alpha-model", "beta-model", "zebra-model"])
	})

	it("handles API error responses", async () => {
		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: false,
			status: 500,
		} as Response)

		const result = await getModelHarborModels()

		expect(console.error).toHaveBeenCalledWith("❌ Failed to fetch ModelHarbor models:", expect.any(Error))
		expect(result).toEqual({})
	})

	it("handles network errors", async () => {
		;(fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error("Network error"))

		const result = await getModelHarborModels()

		expect(console.error).toHaveBeenCalledWith("❌ Failed to fetch ModelHarbor models:", expect.any(Error))
		expect(result).toEqual({})
	})

	it("handles malformed API response", async () => {
		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ invalid: "response" }),
		} as Response)

		const result = await getModelHarborModels()

		expect(result).toEqual({})
	})

	it("handles models without model_name", async () => {
		const mockApiResponse = {
			data: [
				{
					// Missing model_name
					litellm_params: { model: "test-model" },
					model_info: { mode: "chat" },
				},
				{
					model_name: "valid-model",
					litellm_params: { model: "valid-model" },
					model_info: { mode: "chat" },
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		// Should only include the valid model
		expect(Object.keys(result)).toEqual(["valid-model"])
	})

	it("correctly converts token costs to per-million rates", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "cost-test-model",
					litellm_params: { model: "cost-test-model" },
					model_info: {
						input_cost_per_token: 0.000001, // $1 per million tokens
						output_cost_per_token: 0.000002, // $2 per million tokens
						cache_read_input_token_cost: 0.0000005, // $0.50 per million tokens
						mode: "chat",
					},
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		expect(result["cost-test-model"]).toMatchObject({
			inputPrice: 1,
			outputPrice: 2,
			cacheReadsPrice: 0.5,
		})
	})

	it("handles models with max_tokens instead of max_output_tokens", async () => {
		const mockApiResponse = {
			data: [
				{
					model_name: "max-tokens-model",
					litellm_params: { model: "max-tokens-model" },
					model_info: {
						max_tokens: 16384, // Uses max_tokens instead of max_output_tokens
						max_input_tokens: 100000,
						mode: "chat",
					},
				},
			],
		}

		;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
			ok: true,
			json: async () => mockApiResponse,
		} as Response)

		const result = await getModelHarborModels()

		expect(result["max-tokens-model"]).toMatchObject({
			maxTokens: 16384,
			contextWindow: 100000,
		})
	})
})
