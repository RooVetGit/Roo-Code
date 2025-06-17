import axios from "axios"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { LMStudioClient, LLMInfo } from "@lmstudio/sdk" // LLMInfo is a type
import { getLMStudioModels, parseLMStudioModel } from "../lmstudio"
import { ModelInfo, lMStudioDefaultModelInfo } from "@roo-code/types" // ModelInfo is a type

// Mock axios
vi.mock("axios")
const mockedAxios = axios as any

// Mock @lmstudio/sdk
const mockListDownloadedModels = vi.fn()
vi.mock("@lmstudio/sdk", () => {
	return {
		LMStudioClient: vi.fn().mockImplementation(() => ({
			system: {
				listDownloadedModels: mockListDownloadedModels,
			},
		})),
	}
})
const MockedLMStudioClientConstructor = LMStudioClient as any

describe("LMStudio Fetcher", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		MockedLMStudioClientConstructor.mockClear()
	})

	describe("parseLMStudioModel", () => {
		it("should correctly parse raw LLMInfo to ModelInfo", () => {
			const rawModel: LLMInfo = {
				architecture: "llama",
				modelKey: "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
				path: "/Users/username/.cache/lm-studio/models/Mistral AI/Mistral-7B-Instruct-v0.2/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
				type: "llm",
				displayName: "Mistral-7B-Instruct-v0.2-Q4_K_M",
				maxContextLength: 8192,
				paramsString: "7B params, 8k context",
				vision: false,
				format: "gguf",
				sizeBytes: 4080000000,
				trainedForToolUse: false, // Added
			}

			const expectedModelInfo: ModelInfo = {
				...lMStudioDefaultModelInfo,
				description: `${rawModel.displayName} - ${rawModel.paramsString} - ${rawModel.path}`,
				contextWindow: rawModel.maxContextLength,
				supportsPromptCache: true,
				supportsImages: rawModel.vision,
				supportsComputerUse: false,
				maxTokens: rawModel.maxContextLength,
				inputPrice: 0,
				outputPrice: 0,
				cacheWritesPrice: 0,
				cacheReadsPrice: 0,
			}

			const result = parseLMStudioModel(rawModel)
			expect(result).toEqual(expectedModelInfo)
		})
	})

	describe("getLMStudioModels", () => {
		const baseUrl = "http://localhost:1234"
		const lmsUrl = "ws://localhost:1234"

		const mockRawModel: LLMInfo = {
			architecture: "test-arch",
			modelKey: "test-model-key-1",
			path: "/path/to/test-model-1",
			type: "llm",
			displayName: "Test Model One",
			maxContextLength: 2048,
			paramsString: "1B params, 2k context",
			vision: true,
			format: "gguf",
			sizeBytes: 1000000000,
			trainedForToolUse: false, // Added
		}

		it("should fetch and parse models successfully", async () => {
			const mockApiResponse: LLMInfo[] = [mockRawModel]
			mockedAxios.get.mockResolvedValueOnce({ data: { status: "ok" } })
			mockListDownloadedModels.mockResolvedValueOnce(mockApiResponse)

			const result = await getLMStudioModels(baseUrl)

			expect(mockedAxios.get).toHaveBeenCalledTimes(1)
			expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/v1/models`)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledTimes(1)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledWith({ baseUrl: lmsUrl })
			expect(mockListDownloadedModels).toHaveBeenCalledTimes(1)

			const expectedParsedModel = parseLMStudioModel(mockRawModel)
			expect(result).toEqual({ [mockRawModel.modelKey]: expectedParsedModel })
		})

		it("should use default baseUrl if an empty string is provided", async () => {
			const defaultBaseUrl = "http://localhost:1234"
			const defaultLmsUrl = "ws://localhost:1234"
			mockedAxios.get.mockResolvedValueOnce({ data: {} })
			mockListDownloadedModels.mockResolvedValueOnce([])

			await getLMStudioModels("")

			expect(mockedAxios.get).toHaveBeenCalledWith(`${defaultBaseUrl}/v1/models`)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledWith({ baseUrl: defaultLmsUrl })
		})

		it("should transform https baseUrl to wss for LMStudioClient", async () => {
			const httpsBaseUrl = "https://securehost:4321"
			const wssLmsUrl = "wss://securehost:4321"
			mockedAxios.get.mockResolvedValueOnce({ data: {} })
			mockListDownloadedModels.mockResolvedValueOnce([])

			await getLMStudioModels(httpsBaseUrl)

			expect(mockedAxios.get).toHaveBeenCalledWith(`${httpsBaseUrl}/v1/models`)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledWith({ baseUrl: wssLmsUrl })
		})

		it("should return an empty object if lmsUrl is unparsable", async () => {
			const unparsableBaseUrl = "http://localhost:invalid:port" // Leads to ws://localhost:invalid:port

			const result = await getLMStudioModels(unparsableBaseUrl)

			expect(result).toEqual({})
			expect(mockedAxios.get).not.toHaveBeenCalled()
			expect(MockedLMStudioClientConstructor).not.toHaveBeenCalled()
		})

		it("should return an empty object and log error if axios.get fails with a generic error", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const networkError = new Error("Network connection failed")
			mockedAxios.get.mockRejectedValueOnce(networkError)

			const result = await getLMStudioModels(baseUrl)

			expect(mockedAxios.get).toHaveBeenCalledTimes(1)
			expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/v1/models`)
			expect(MockedLMStudioClientConstructor).not.toHaveBeenCalled()
			expect(mockListDownloadedModels).not.toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`Error fetching LMStudio models: ${JSON.stringify(networkError, Object.getOwnPropertyNames(networkError), 2)}`,
			)
			expect(result).toEqual({})
			consoleErrorSpy.mockRestore()
		})

		it("should return an empty object and log info if axios.get fails with ECONNREFUSED", async () => {
			const consoleInfoSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const econnrefusedError = new Error("Connection refused")
			;(econnrefusedError as any).code = "ECONNREFUSED"
			mockedAxios.get.mockRejectedValueOnce(econnrefusedError)

			const result = await getLMStudioModels(baseUrl)

			expect(mockedAxios.get).toHaveBeenCalledTimes(1)
			expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/v1/models`)
			expect(MockedLMStudioClientConstructor).not.toHaveBeenCalled()
			expect(mockListDownloadedModels).not.toHaveBeenCalled()
			expect(consoleInfoSpy).toHaveBeenCalledWith(`Error connecting to LMStudio at ${baseUrl}`)
			expect(result).toEqual({})
			consoleInfoSpy.mockRestore()
		})

		it("should return an empty object and log error if listDownloadedModels fails", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const listError = new Error("LMStudio SDK internal error")

			mockedAxios.get.mockResolvedValueOnce({ data: {} })
			mockListDownloadedModels.mockRejectedValueOnce(listError)

			const result = await getLMStudioModels(baseUrl)

			expect(mockedAxios.get).toHaveBeenCalledTimes(1)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledTimes(1)
			expect(MockedLMStudioClientConstructor).toHaveBeenCalledWith({ baseUrl: lmsUrl })
			expect(mockListDownloadedModels).toHaveBeenCalledTimes(1)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`Error fetching LMStudio models: ${JSON.stringify(listError, Object.getOwnPropertyNames(listError), 2)}`,
			)
			expect(result).toEqual({})
			consoleErrorSpy.mockRestore()
		})
	})
})
