import * as vscode from "vscode"
import { OpenAiEmbedder } from "./embedders/openai"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"
import { OpenAICompatibleEmbedder } from "./embedders/openai-compatible"
import { GeminiEmbedder } from "./embedders/gemini"
import { EmbedderProvider, getDefaultModelId, getModelDimension } from "../../shared/embeddingModels"
import { QdrantVectorStore } from "./vector-store/qdrant-client"
import { codeParser, DirectoryScanner, FileWatcher } from "./processors"
import { ICodeParser, IEmbedder, IFileWatcher, IVectorStore } from "./interfaces"
import { CodeIndexConfigManager } from "./config-manager"
import { CacheManager } from "./cache-manager"
import { Ignore } from "ignore"

/**
 * Factory class responsible for creating and configuring code indexing service dependencies.
 */
export class CodeIndexServiceFactory {
	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
	) {}

	/**
	 * Creates an embedder instance based on the current configuration.
	 */
	public createEmbedder(): IEmbedder {
		const config = this.configManager.getConfig()
		console.log(`[DEBUG ServiceFactory] Creating embedder for provider: ${config.embedderProvider}`)

		const provider = config.embedderProvider as EmbedderProvider

		if (provider === "openai") {
			const apiKey = config.openAiOptions?.openAiNativeApiKey
			console.log(
				`[DEBUG ServiceFactory] OpenAI embedder - API key: ${apiKey ? `"${apiKey.substring(0, 4)}..."` : "undefined"}`,
			)

			if (!apiKey) {
				throw new Error("OpenAI configuration missing for embedder creation")
			}
			console.log(`[DEBUG ServiceFactory] Creating OpenAI embedder with key: "${apiKey.substring(0, 4)}..."`)
			return new OpenAiEmbedder({
				...config.openAiOptions,
				openAiEmbeddingModelId: config.modelId,
			})
		} else if (provider === "ollama") {
			if (!config.ollamaOptions?.ollamaBaseUrl) {
				throw new Error("Ollama configuration missing for embedder creation")
			}
			console.log(`[DEBUG ServiceFactory] Creating Ollama embedder`)
			return new CodeIndexOllamaEmbedder({
				...config.ollamaOptions,
				ollamaModelId: config.modelId,
			})
		} else if (provider === "openai-compatible") {
			if (!config.openAiCompatibleOptions?.baseUrl || !config.openAiCompatibleOptions?.apiKey) {
				throw new Error("OpenAI Compatible configuration missing for embedder creation")
			}
			console.log(`[DEBUG ServiceFactory] Creating OpenAI Compatible embedder`)
			return new OpenAICompatibleEmbedder(
				config.openAiCompatibleOptions.baseUrl,
				config.openAiCompatibleOptions.apiKey,
				config.modelId,
			)
		} else if (provider === "gemini") {
			if (!config.geminiOptions?.apiKey) {
				throw new Error("Gemini configuration missing for embedder creation")
			}
			return new GeminiEmbedder(config.geminiOptions.apiKey)
		}

		throw new Error(`Invalid embedder type configured: ${config.embedderProvider}`)
	}

	/**
	 * Creates a vector store instance using the current configuration.
	 */
	public createVectorStore(): IVectorStore {
		const config = this.configManager.getConfig()

		const provider = config.embedderProvider as EmbedderProvider
		const defaultModel = getDefaultModelId(provider)
		// Use the embedding model ID from config, not the chat model IDs
		const modelId = config.modelId ?? defaultModel

		let vectorSize: number | undefined

		if (provider === "openai-compatible") {
			if (config.openAiCompatibleOptions?.modelDimension && config.openAiCompatibleOptions.modelDimension > 0) {
				vectorSize = config.openAiCompatibleOptions.modelDimension
			} else {
				// Fallback if not provided or invalid in openAiCompatibleOptions
				vectorSize = getModelDimension(provider, modelId)
			}
		} else if (provider === "gemini") {
			// Gemini's text-embedding-004 has a fixed dimension of 768
			vectorSize = 768
		} else {
			vectorSize = getModelDimension(provider, modelId)
		}

		if (vectorSize === undefined) {
			let errorMessage = `Could not determine vector dimension for model '${modelId}' with provider '${provider}'. `
			if (provider === "openai-compatible") {
				errorMessage += `Please ensure the 'Embedding Dimension' is correctly set in the OpenAI-Compatible provider settings.`
			} else {
				errorMessage += `Check model profiles or configuration.`
			}
			throw new Error(errorMessage)
		}

		if (!config.qdrantUrl) {
			// This check remains important
			throw new Error("Qdrant URL missing for vector store creation")
		}

		// Assuming constructor is updated: new QdrantVectorStore(workspacePath, url, vectorSize, apiKey?)
		console.log(
			`[DEBUG ServiceFactory] Creating Qdrant vector store with API key: ${config.qdrantApiKey ? `"${config.qdrantApiKey.substring(0, 4)}..."` : "undefined"}`,
		)
		return new QdrantVectorStore(this.workspacePath, config.qdrantUrl, vectorSize, config.qdrantApiKey)
	}

	/**
	 * Creates a directory scanner instance with its required dependencies.
	 */
	public createDirectoryScanner(
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		parser: ICodeParser,
		ignoreInstance: Ignore,
	): DirectoryScanner {
		return new DirectoryScanner(embedder, vectorStore, parser, this.cacheManager, ignoreInstance)
	}

	/**
	 * Creates a file watcher instance with its required dependencies.
	 */
	public createFileWatcher(
		context: vscode.ExtensionContext,
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
	): IFileWatcher {
		return new FileWatcher(this.workspacePath, context, cacheManager, embedder, vectorStore, ignoreInstance)
	}

	/**
	 * Creates all required service dependencies if the service is properly configured.
	 * @throws Error if the service is not properly configured
	 */
	public createServices(
		context: vscode.ExtensionContext,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
	): {
		embedder: IEmbedder
		vectorStore: IVectorStore
		parser: ICodeParser
		scanner: DirectoryScanner
		fileWatcher: IFileWatcher
	} {
		console.log(`[DEBUG ServiceFactory] createServices called`)
		console.log(`[DEBUG ServiceFactory] isFeatureConfigured: ${this.configManager.isFeatureConfigured}`)

		if (!this.configManager.isFeatureConfigured) {
			console.log(`[DEBUG ServiceFactory] ERROR: Code indexing is not properly configured`)
			throw new Error("Cannot create services: Code indexing is not properly configured")
		}

		console.log(`[DEBUG ServiceFactory] Creating embedder...`)
		const embedder = this.createEmbedder()
		console.log(`[DEBUG ServiceFactory] Embedder created successfully`)
		const vectorStore = this.createVectorStore()
		const parser = codeParser
		const scanner = this.createDirectoryScanner(embedder, vectorStore, parser, ignoreInstance)
		const fileWatcher = this.createFileWatcher(context, embedder, vectorStore, cacheManager, ignoreInstance)

		return {
			embedder,
			vectorStore,
			parser,
			scanner,
			fileWatcher,
		}
	}
}
