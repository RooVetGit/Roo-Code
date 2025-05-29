// npx jest src/api/providers/fetchers/__tests__/nebius.test.ts

import axios from "axios"
import { getNebiusModels } from "../nebius"
import { LITELLM_COMPUTER_USE_MODELS } from "../../../../shared/api"

jest.mock("axios")

describe("Nebius API", () => {
	describe("getNebiusModels", () => {
		const mockApiKey = "test-api-key"
		const mockBaseUrl = "https://api.studio.nebius.ai/v1"

		beforeEach(() => {
			jest.clearAllMocks()
		})

		it("fetches models and validates schema", async () => {
			const mockResponse = {
				data: {
					data: [
						{
							model_name: "Qwen/Qwen2.5-32B-Instruct-fast",
							model_info: {
								max_tokens: 8192,
								max_input_tokens: 32768,
								supports_vision: false,
								supports_prompt_caching: false,
								input_cost_per_token: 0.00000013,
								output_cost_per_token: 0.0000004,
							},
							nebius_params: {
								model: "qwen/qwen2.5-32b-instruct",
							},
						},
						{
							model_name: "deepseek-ai/DeepSeek-R1",
							model_info: {
								max_tokens: 32000,
								max_input_tokens: 96000,
								supports_vision: false,
								supports_prompt_caching: false,
								input_cost_per_token: 0.0000008,
								output_cost_per_token: 0.0000024,
							},
							nebius_params: {
								model: "deepseek/deepseek-r1",
							},
						},
					],
				},
			}

			;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

			const result = await getNebiusModels(mockApiKey, mockBaseUrl)

			expect(axios.get).toHaveBeenCalledWith(`${mockBaseUrl}/v1/model/info`, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockApiKey}`,
				},
			})

			expect(result["Qwen/Qwen2.5-32B-Instruct-fast"]).toMatchObject({
				maxTokens: 8192,
				contextWindow: 32768,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				description: "Qwen/Qwen2.5-32B-Instruct-fast via Nebius proxy",
			})
			expect(result["Qwen/Qwen2.5-32B-Instruct-fast"].inputPrice).toBeCloseTo(0.13, 5)
			expect(result["Qwen/Qwen2.5-32B-Instruct-fast"].outputPrice).toBeCloseTo(0.4, 5)

			expect(result["deepseek-ai/DeepSeek-R1"]).toMatchObject({
				maxTokens: 32000,
				contextWindow: 96000,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: false,
				description: "deepseek-ai/DeepSeek-R1 via Nebius proxy",
			})
			expect(result["deepseek-ai/DeepSeek-R1"].inputPrice).toBeCloseTo(0.8, 5)
			expect(result["deepseek-ai/DeepSeek-R1"].outputPrice).toBeCloseTo(2.4, 5)
		})

		it("validates computer use models", async () => {
			const mockResponse = {
				data: {
					data: [
						{
							model_name: "anthropic/claude-3.5-sonnet",
							model_info: {
								max_tokens: 8192,
								max_input_tokens: 200000,
								supports_vision: true,
								supports_prompt_caching: true,
							},
							nebius_params: {
								model: "anthropic/claude-3.5-sonnet",
							},
						},
						{
							model_name: "anthropic/claude-3.7-sonnet",
							model_info: {
								max_tokens: 8192,
								max_input_tokens: 200000,
								supports_vision: true,
								supports_prompt_caching: true,
							},
							nebius_params: {
								model: "anthropic/claude-3.7-sonnet",
							},
						},
					],
				},
			}

			;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

			const result = await getNebiusModels(mockApiKey, mockBaseUrl)

			// Verify that computer use models are correctly identified
			const computerUseModels = Object.entries(result)
				.filter(([_, model]) => model.supportsComputerUse)
				.map(([id, _]) => id)

			expect(computerUseModels).toContain("anthropic/claude-3.5-sonnet")
			expect(computerUseModels).toContain("anthropic/claude-3.7-sonnet")

			// Verify these models are in the LITELLM_COMPUTER_USE_MODELS set
			computerUseModels.forEach((modelId) => {
				expect(LITELLM_COMPUTER_USE_MODELS.has(modelId)).toBe(true)
			})
		})

		it("handles missing model info gracefully", async () => {
			const mockResponse = {
				data: {
					data: [
						{
							model_name: "test-model",
							// Missing model_info
						},
						{
							// Missing model_name
							model_info: {
								max_tokens: 8192,
							},
						},
						{
							model_name: "another-model",
							model_info: {
								max_tokens: 8192,
							},
							// Missing nebius_params
						},
					],
				},
			}

			;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

			const result = await getNebiusModels(mockApiKey, mockBaseUrl)

			expect(result).toEqual({})
		})

		it("handles invalid response format", async () => {
			const mockResponse = {
				data: {
					// Invalid structure - missing 'data' array
					models: [],
				},
			}

			;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

			const result = await getNebiusModels(mockApiKey, mockBaseUrl)

			expect(result).toEqual({})
		})

		it("handles API errors gracefully", async () => {
			;(axios.get as jest.Mock).mockRejectedValue(new Error("Network error"))

			const result = await getNebiusModels(mockApiKey, mockBaseUrl)

			expect(result).toEqual({})
		})

		it("handles missing API key", async () => {
			const mockResponse = {
				data: {
					data: [],
				},
			}

			;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

			const result = await getNebiusModels("", mockBaseUrl)

			expect(axios.get).toHaveBeenCalledWith(`${mockBaseUrl}/v1/model/info`, {
				headers: {
					"Content-Type": "application/json",
				},
			})

			expect(result).toEqual({})
		})
	})
})
