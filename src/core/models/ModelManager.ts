import axios from "axios"
import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { SettingsManager, SecretKey, GlobalStateKey } from "../settings/SettingsManager"
import { ApiProvider, ModelInfo } from "../../shared/api"
import { fileExistsAtPath } from "../../utils/fs"

/**
 * File names for model cache files
 */
export const ModelCacheFileNames = {
	glamaModels: "glama_models.json",
	openRouterModels: "openrouter_models.json",
	requestyModels: "requesty_models.json",
	unboundModels: "unbound_models.json",
}

/**
 * ModelManager is responsible for fetching, caching, and managing models from various providers.
 */
export class ModelManager {
	private settingsManager: SettingsManager
	private outputChannel: vscode.OutputChannel
	private cacheDir: string | null = null

	/**
	 * Creates a new instance of ModelManager
	 *
	 * @param context The extension context
	 * @param outputChannel The output channel for logging
	 * @param settingsManager The settings manager instance
	 */
	constructor(
		private readonly context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		settingsManager: SettingsManager,
	) {
		this.outputChannel = outputChannel
		this.settingsManager = settingsManager
	}

	/**
	 * Ensures the cache directory exists and returns its path
	 *
	 * @returns The path to the cache directory
	 */
	private async ensureCacheDirectoryExists(): Promise<string> {
		if (this.cacheDir) {
			return this.cacheDir
		}

		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		await fs.mkdir(cacheDir, { recursive: true })
		this.cacheDir = cacheDir
		return cacheDir
	}

	/**
	 * Reads model information from a cache file
	 *
	 * @param filename The name of the cache file
	 * @returns The model information, or undefined if the file doesn't exist
	 */
	private async readModelsFromCache(filename: string): Promise<Record<string, ModelInfo> | undefined> {
		const filePath = path.join(await this.ensureCacheDirectoryExists(), filename)
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			const fileContents = await fs.readFile(filePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	/**
	 * Gets models from Ollama
	 *
	 * @param baseUrl The base URL for the Ollama API
	 * @returns An array of model names
	 */
	async getOllamaModels(baseUrl?: string): Promise<string[]> {
		try {
			if (!baseUrl) {
				baseUrl = "http://localhost:11434"
			}
			if (!URL.canParse(baseUrl)) {
				return []
			}
			const response = await axios.get(`${baseUrl}/api/tags`)
			const modelsArray = response.data?.models?.map((model: any) => model.name) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	/**
	 * Gets models from LM Studio
	 *
	 * @param baseUrl The base URL for the LM Studio API
	 * @returns An array of model names
	 */
	async getLmStudioModels(baseUrl?: string): Promise<string[]> {
		try {
			if (!baseUrl) {
				baseUrl = "http://localhost:1234"
			}
			if (!URL.canParse(baseUrl)) {
				return []
			}
			const response = await axios.get(`${baseUrl}/v1/models`)
			const modelsArray = response.data?.data?.map((model: any) => model.id) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	/**
	 * Gets models from VSCode LM API
	 *
	 * @returns An array of model selectors
	 */
	async getVsCodeLmModels(): Promise<vscode.LanguageModelChatSelector[]> {
		try {
			const models = await vscode.lm.selectChatModels({})
			return models || []
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching VS Code LM models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			return []
		}
	}

	/**
	 * Gets models from OpenAI
	 *
	 * @param baseUrl The base URL for the OpenAI API
	 * @param apiKey The API key for OpenAI
	 * @returns An array of model names
	 */
	async getOpenAiModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
		try {
			if (!baseUrl) {
				return []
			}

			if (!URL.canParse(baseUrl)) {
				return []
			}

			const config: Record<string, any> = {}
			if (apiKey) {
				config["headers"] = { Authorization: `Bearer ${apiKey}` }
			}

			const response = await axios.get(`${baseUrl}/models`, config)
			const modelsArray = response.data?.data?.map((model: any) => model.id) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	/**
	 * Reads Requesty models from cache
	 *
	 * @returns The Requesty models, or undefined if the cache doesn't exist
	 */
	async readRequestyModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(ModelCacheFileNames.requestyModels)
	}

	/**
	 * Refreshes Requesty models from the API
	 *
	 * @param apiKey The API key for Requesty
	 * @returns The refreshed Requesty models
	 */
	async refreshRequestyModels(apiKey?: string): Promise<Record<string, ModelInfo>> {
		const requestyModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			ModelCacheFileNames.requestyModels,
		)

		const models: Record<string, ModelInfo> = {}
		try {
			const config: Record<string, any> = {}
			if (!apiKey) {
				apiKey = (await this.settingsManager.getSecret("requestyApiKey")) as string
			}

			if (!apiKey) {
				this.outputChannel.appendLine("No Requesty API key found")
				return models
			}

			if (apiKey) {
				config["headers"] = { Authorization: `Bearer ${apiKey}` }
			}

			const response = await axios.get("https://router.requesty.ai/v1/models", config)

			if (response.data) {
				const rawModels = response.data.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.max_output_tokens,
						contextWindow: rawModel.context_window,
						supportsImages: rawModel.support_image,
						supportsComputerUse: rawModel.support_computer_use,
						supportsPromptCache: rawModel.supports_caching,
						inputPrice: parsePrice(rawModel.input_price),
						outputPrice: parsePrice(rawModel.output_price),
						description: rawModel.description,
						cacheWritesPrice: parsePrice(rawModel.caching_price),
						cacheReadsPrice: parsePrice(rawModel.cached_price),
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from Requesty API")
			}
			await fs.writeFile(requestyModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Requesty models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		return models
	}

	/**
	 * Reads Glama models from cache
	 *
	 * @returns The Glama models, or undefined if the cache doesn't exist
	 */
	async readGlamaModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(ModelCacheFileNames.glamaModels)
	}

	/**
	 * Refreshes Glama models from the API
	 *
	 * @returns The refreshed Glama models
	 */
	async refreshGlamaModels(): Promise<Record<string, ModelInfo>> {
		const glamaModelsFilePath = path.join(await this.ensureCacheDirectoryExists(), ModelCacheFileNames.glamaModels)

		const models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://glama.ai/api/gateway/v1/models")
			/*
                {
                    "added": "2024-12-24T15:12:49.324Z",
                    "capabilities": [
                        "adjustable_safety_settings",
                        "caching",
                        "code_execution",
                        "function_calling",
                        "json_mode",
                        "json_schema",
                        "system_instructions",
                        "tuning",
                        "input:audio",
                        "input:image",
                        "input:text",
                        "input:video",
                        "output:text"
                    ],
                    "id": "google-vertex/gemini-1.5-flash-002",
                    "maxTokensInput": 1048576,
                    "maxTokensOutput": 8192,
                    "pricePerToken": {
                        "cacheRead": null,
                        "cacheWrite": null,
                        "input": "0.000000075",
                        "output": "0.0000003"
                    }
                }
            */
			if (response.data) {
				const rawModels = response.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.maxTokensOutput,
						contextWindow: rawModel.maxTokensInput,
						supportsImages: rawModel.capabilities?.includes("input:image"),
						supportsComputerUse: rawModel.capabilities?.includes("computer_use"),
						supportsPromptCache: rawModel.capabilities?.includes("caching"),
						inputPrice: parsePrice(rawModel.pricePerToken?.input),
						outputPrice: parsePrice(rawModel.pricePerToken?.output),
						description: undefined,
						cacheWritesPrice: parsePrice(rawModel.pricePerToken?.cacheWrite),
						cacheReadsPrice: parsePrice(rawModel.pricePerToken?.cacheRead),
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from Glama API")
			}
			await fs.writeFile(glamaModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Glama models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		return models
	}

	/**
	 * Reads OpenRouter models from cache
	 *
	 * @returns The OpenRouter models, or undefined if the cache doesn't exist
	 */
	async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(ModelCacheFileNames.openRouterModels)
	}

	/**
	 * Refreshes OpenRouter models from the API
	 *
	 * @returns The refreshed OpenRouter models
	 */
	async refreshOpenRouterModels(): Promise<Record<string, ModelInfo>> {
		const openRouterModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			ModelCacheFileNames.openRouterModels,
		)

		const models: Record<string, ModelInfo> = {}

		try {
			const response = await axios.get("https://openrouter.ai/api/v1/models")

			if (response.data?.data) {
				const rawModels = response.data.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}

				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.top_provider?.max_completion_tokens,
						contextWindow: rawModel.context_length,
						supportsImages: rawModel.architecture?.modality?.includes("image"),
						supportsPromptCache: false,
						inputPrice: parsePrice(rawModel.pricing?.prompt),
						outputPrice: parsePrice(rawModel.pricing?.completion),
						description: rawModel.description,
					}

					switch (rawModel.id) {
						case "anthropic/claude-3.7-sonnet":
						case "anthropic/claude-3.7-sonnet:beta":
						case "anthropic/claude-3.5-sonnet":
						case "anthropic/claude-3.5-sonnet:beta":
							// NOTE: this needs to be synced with api.ts/openrouter default model info.
							modelInfo.supportsComputerUse = true
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 3.75
							modelInfo.cacheReadsPrice = 0.3
							break
						case "anthropic/claude-3.5-sonnet-20240620":
						case "anthropic/claude-3.5-sonnet-20240620:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 3.75
							modelInfo.cacheReadsPrice = 0.3
							break
						case "anthropic/claude-3-5-haiku":
						case "anthropic/claude-3-5-haiku:beta":
						case "anthropic/claude-3-5-haiku-20241022":
						case "anthropic/claude-3-5-haiku-20241022:beta":
						case "anthropic/claude-3.5-haiku":
						case "anthropic/claude-3.5-haiku:beta":
						case "anthropic/claude-3.5-haiku-20241022":
						case "anthropic/claude-3.5-haiku-20241022:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 1.25
							modelInfo.cacheReadsPrice = 0.1
							break
						case "anthropic/claude-3-opus":
						case "anthropic/claude-3-opus:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 18.75
							modelInfo.cacheReadsPrice = 1.5
							break
						case "anthropic/claude-3-haiku":
						case "anthropic/claude-3-haiku:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 0.3
							modelInfo.cacheReadsPrice = 0.03
							break
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from OpenRouter API")
			}
			await fs.writeFile(openRouterModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching OpenRouter models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		return models
	}

	/**
	 * Reads Unbound models from cache
	 *
	 * @returns The Unbound models, or undefined if the cache doesn't exist
	 */
	async readUnboundModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(ModelCacheFileNames.unboundModels)
	}

	/**
	 * Refreshes Unbound models from the API
	 *
	 * @returns The refreshed Unbound models
	 */
	async refreshUnboundModels(): Promise<Record<string, ModelInfo>> {
		const unboundModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			ModelCacheFileNames.unboundModels,
		)

		const models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://api.getunbound.ai/models")

			if (response.data) {
				const rawModels: Record<string, any> = response.data
				for (const [modelId, model] of Object.entries(rawModels)) {
					models[modelId] = {
						maxTokens: model?.maxTokens ? parseInt(model.maxTokens) : undefined,
						contextWindow: model?.contextWindow ? parseInt(model.contextWindow) : 0,
						supportsImages: model?.supportsImages ?? false,
						supportsPromptCache: model?.supportsPromptCaching ?? false,
						supportsComputerUse: model?.supportsComputerUse ?? false,
						inputPrice: model?.inputTokenPrice ? parseFloat(model.inputTokenPrice) : undefined,
						outputPrice: model?.outputTokenPrice ? parseFloat(model.outputTokenPrice) : undefined,
						cacheWritesPrice: model?.cacheWritePrice ? parseFloat(model.cacheWritePrice) : undefined,
						cacheReadsPrice: model?.cacheReadPrice ? parseFloat(model.cacheReadPrice) : undefined,
					}
				}
			}
			await fs.writeFile(unboundModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Unbound models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		return models
	}

	/**
	 * Handles the OpenRouter callback to exchange a code for an API key
	 *
	 * @param code The code to exchange for an API key
	 * @returns The API key
	 */
	async handleOpenRouterCallback(code: string): Promise<string> {
		try {
			const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code })
			if (response.data && response.data.key) {
				return response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			this.outputChannel.appendLine(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}
	}

	/**
	 * Handles the Glama callback to exchange a code for an API key
	 *
	 * @param code The code to exchange for an API key
	 * @returns The API key
	 */
	async handleGlamaCallback(code: string): Promise<string> {
		try {
			const response = await axios.post("https://glama.ai/api/gateway/v1/auth/exchange-code", { code })
			if (response.data && response.data.apiKey) {
				return response.data.apiKey
			} else {
				throw new Error("Invalid response from Glama API")
			}
		} catch (error) {
			this.outputChannel.appendLine(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}
	}
}
