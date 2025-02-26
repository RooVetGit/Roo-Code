import axios from "axios"
import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { ModelManager, ModelCacheFileNames } from "../ModelManager"
import { SettingsManager } from "../../settings/SettingsManager"
import { fileExistsAtPath } from "../../../utils/fs"

// Mock dependencies
jest.mock("axios")
jest.mock("fs/promises")
jest.mock("../../../utils/fs")
jest.mock("../../settings/SettingsManager")

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedFs = fs as jest.Mocked<typeof fs>
const mockedFileExistsAtPath = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>

describe("ModelManager", () => {
	let modelManager: ModelManager
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockSettingsManager: jest.Mocked<SettingsManager>

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock context
		mockContext = {
			globalStorageUri: { fsPath: "/mock/storage/path" } as vscode.Uri,
		} as vscode.ExtensionContext

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Mock settings manager
		mockSettingsManager = new SettingsManager(mockContext) as jest.Mocked<SettingsManager>

		// Create model manager instance
		modelManager = new ModelManager(mockContext, mockOutputChannel, mockSettingsManager)

		// Default mock for mkdir
		mockedFs.mkdir.mockResolvedValue(undefined)
	})

	describe("ensureCacheDirectoryExists", () => {
		it("should create cache directory if it doesn't exist", async () => {
			// Call the private method using any type assertion
			const cacheDir = await (modelManager as any).ensureCacheDirectoryExists()

			expect(mockedFs.mkdir).toHaveBeenCalledWith(path.join("/mock/storage/path", "cache"), { recursive: true })
			expect(cacheDir).toBe(path.join("/mock/storage/path", "cache"))
		})

		it("should reuse cached directory path if already created", async () => {
			// Call twice
			await (modelManager as any).ensureCacheDirectoryExists()
			await (modelManager as any).ensureCacheDirectoryExists()

			// Should only call mkdir once
			expect(mockedFs.mkdir).toHaveBeenCalledTimes(1)
		})
	})

	describe("readModelsFromCache", () => {
		it("should return undefined if file doesn't exist", async () => {
			mockedFileExistsAtPath.mockResolvedValue(false)

			const result = await (modelManager as any).readModelsFromCache("test.json")

			expect(result).toBeUndefined()
			expect(mockedFileExistsAtPath).toHaveBeenCalled()
			expect(mockedFs.readFile).not.toHaveBeenCalled()
		})

		it("should read and parse file if it exists", async () => {
			const mockData = { model1: { maxTokens: 4000 } }
			mockedFileExistsAtPath.mockResolvedValue(true)
			mockedFs.readFile.mockResolvedValue(JSON.stringify(mockData))

			const result = await (modelManager as any).readModelsFromCache("test.json")

			expect(result).toEqual(mockData)
			expect(mockedFileExistsAtPath).toHaveBeenCalled()
			expect(mockedFs.readFile).toHaveBeenCalled()
		})
	})

	describe("getOllamaModels", () => {
		it("should return empty array on error", async () => {
			mockedAxios.get.mockRejectedValue(new Error("Network error"))

			const result = await modelManager.getOllamaModels()

			expect(result).toEqual([])
		})

		it("should return models from Ollama API", async () => {
			mockedAxios.get.mockResolvedValue({
				data: {
					models: [
						{ name: "model1" },
						{ name: "model2" },
						{ name: "model1" }, // Duplicate to test Set
					],
				},
			})

			const result = await modelManager.getOllamaModels()

			expect(result).toEqual(["model1", "model2"])
			expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:11434/api/tags")
		})

		it("should use custom base URL if provided", async () => {
			mockedAxios.get.mockResolvedValue({
				data: {
					models: [{ name: "model1" }],
				},
			})

			await modelManager.getOllamaModels("http://custom:1234")

			expect(mockedAxios.get).toHaveBeenCalledWith("http://custom:1234/api/tags")
		})
	})

	describe("getLmStudioModels", () => {
		it("should return empty array on error", async () => {
			mockedAxios.get.mockRejectedValue(new Error("Network error"))

			const result = await modelManager.getLmStudioModels()

			expect(result).toEqual([])
		})

		it("should return models from LM Studio API", async () => {
			mockedAxios.get.mockResolvedValue({
				data: {
					data: [
						{ id: "model1" },
						{ id: "model2" },
						{ id: "model1" }, // Duplicate to test Set
					],
				},
			})

			const result = await modelManager.getLmStudioModels()

			expect(result).toEqual(["model1", "model2"])
			expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:1234/v1/models")
		})
	})

	describe("refreshOpenRouterModels", () => {
		it("should handle API errors gracefully", async () => {
			mockedAxios.get.mockRejectedValue(new Error("Network error"))

			const result = await modelManager.refreshOpenRouterModels()

			expect(result).toEqual({})
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("should parse and save OpenRouter models", async () => {
			// Mock the axios response with the expected structure
			mockedAxios.get.mockResolvedValue({
				data: {
					data: [
						{
							id: "model1",
							context_length: 8000,
							top_provider: { max_completion_tokens: 4000 },
							architecture: { modality: ["text", "image"] },
							pricing: { prompt: "0.000001", completion: "0.000002" },
							description: "Test model",
						},
						{
							id: "anthropic/claude-3.5-sonnet",
							context_length: 200000,
							top_provider: { max_completion_tokens: 4096 },
							architecture: { modality: ["text"] },
							pricing: { prompt: "0.000003", completion: "0.000004" },
							description: "Claude model",
						},
					],
				},
			})

			// Call the method
			const result = await modelManager.refreshOpenRouterModels()

			// Verify the result contains both models
			expect(Object.keys(result)).toContain("model1")
			expect(Object.keys(result)).toContain("anthropic/claude-3.5-sonnet")

			// Verify the special properties for Claude model
			const claudeModel = result["anthropic/claude-3.5-sonnet"]
			expect(claudeModel).toBeDefined()
			expect(claudeModel.supportsPromptCache).toBe(true)
			expect(claudeModel.supportsComputerUse).toBe(true)
			expect(claudeModel.cacheWritesPrice).toBe(3.75)
			expect(claudeModel.cacheReadsPrice).toBe(0.3)

			// Verify the file was written
			expect(mockedFs.writeFile).toHaveBeenCalled()
		})
	})

	describe("handleOpenRouterCallback", () => {
		it("should exchange code for API key", async () => {
			mockedAxios.post.mockResolvedValue({
				data: { key: "test-api-key" },
			})

			const result = await modelManager.handleOpenRouterCallback("test-code")

			expect(result).toBe("test-api-key")
			expect(mockedAxios.post).toHaveBeenCalledWith("https://openrouter.ai/api/v1/auth/keys", {
				code: "test-code",
			})
		})

		it("should throw error if response is invalid", async () => {
			mockedAxios.post.mockResolvedValue({
				data: {}, // No key property
			})

			await expect(modelManager.handleOpenRouterCallback("test-code")).rejects.toThrow(
				"Invalid response from OpenRouter API",
			)
		})

		it("should throw error if API call fails", async () => {
			mockedAxios.post.mockRejectedValue(new Error("Network error"))

			await expect(modelManager.handleOpenRouterCallback("test-code")).rejects.toThrow()
		})
	})
})
