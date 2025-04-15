import * as vscode from "vscode"
import { ApiHandlerOptions } from "../../shared/api"
import { OpenAiEmbedder } from "./embedders/openai"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"
import { QdrantVectorStore } from "./vector-store/qdrant-client"
import { CodeParser, DirectoryScanner, FileWatcher } from "./processors"
import { ICodeParser, IEmbedder, IFileWatcher, IVectorStore } from "./interfaces"
import { CodeIndexConfigManager } from "./config-manager"

/**
 * Factory class responsible for creating and configuring code indexing service dependencies.
 */
export class CodeIndexServiceFactory {
	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly workspacePath: string,
	) {}

	/**
	 * Creates an embedder instance based on the current configuration.
	 */
	protected createEmbedder(): IEmbedder {
		const config = this.configManager.getConfig()

		if (config.embedderType === "openai") {
			if (!config.openAiOptions?.openAiNativeApiKey) {
				throw new Error("OpenAI configuration missing for embedder creation")
			}
			return new OpenAiEmbedder(config.openAiOptions)
		} else if (config.embedderType === "ollama") {
			if (!config.ollamaOptions?.ollamaBaseUrl) {
				throw new Error("Ollama configuration missing for embedder creation")
			}
			return new CodeIndexOllamaEmbedder(config.ollamaOptions)
		}

		throw new Error(`Invalid embedder type configured: ${config.embedderType}`)
	}

	/**
	 * Creates a vector store instance using the current configuration.
	 */
	protected createVectorStore(): IVectorStore {
		const config = this.configManager.getConfig()

		if (!config.qdrantUrl) {
			throw new Error("Qdrant URL missing for vector store creation")
		}

		return new QdrantVectorStore(this.workspacePath, config.qdrantUrl, config.qdrantApiKey)
	}

	/**
	 * Creates a code parser instance.
	 */
	protected createCodeParser(): ICodeParser {
		return new CodeParser()
	}

	/**
	 * Creates a directory scanner instance with its required dependencies.
	 */
	protected createDirectoryScanner(
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		parser: ICodeParser,
	): DirectoryScanner {
		return new DirectoryScanner(embedder, vectorStore, parser)
	}

	/**
	 * Creates a file watcher instance with its required dependencies.
	 */
	protected createFileWatcher(
		context: vscode.ExtensionContext,
		embedder: IEmbedder,
		vectorStore: IVectorStore,
	): IFileWatcher {
		return new FileWatcher(this.workspacePath, context, embedder, vectorStore)
	}

	/**
	 * Creates all required service dependencies if the service is properly configured.
	 * @throws Error if the service is not properly configured
	 */
	public createServices(context: vscode.ExtensionContext): {
		embedder: IEmbedder
		vectorStore: IVectorStore
		parser: ICodeParser
		scanner: DirectoryScanner
		fileWatcher: IFileWatcher
	} {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error("Cannot create services: Code indexing is not properly configured")
		}

		const embedder = this.createEmbedder()
		const vectorStore = this.createVectorStore()
		const parser = this.createCodeParser()
		const scanner = this.createDirectoryScanner(embedder, vectorStore, parser)
		const fileWatcher = this.createFileWatcher(context, embedder, vectorStore)

		return {
			embedder,
			vectorStore,
			parser,
			scanner,
			fileWatcher,
		}
	}
}
