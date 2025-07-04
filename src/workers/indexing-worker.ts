import { parentPort } from "worker_threads"
import { WorkerCommand, WorkerResponse, WorkerMessage, WorkerInitConfig } from "../services/code-index/worker-messenger"
import { CodeIndexStateManager } from "../services/code-index/worker-utils/state-manager"
import { CacheManager } from "../services/code-index/worker-utils/cache-manager"
import { Scanner as DirectoryScanner } from "../services/code-index/worker-utils/scanner"
import { FileWatcher } from "../services/code-index/worker-utils/file-watcher"
import { RooIgnoreController } from "../services/code-index/worker-utils/RooIgnoreController"
import { VectorStoreSearchResult } from "../services/code-index/interfaces"
import ignore from "ignore"
import * as fs from "fs/promises"
import * as path from "path"
import { v5 as uuidv5 } from "uuid"
import { createHash } from "crypto"

// Import embedders and vector store directly
import { OpenAiEmbedder } from "../services/code-index/embedders/openai"
import { CodeIndexOllamaEmbedder } from "../services/code-index/embedders/ollama"
import { OpenAICompatibleEmbedder } from "../services/code-index/embedders/openai-compatible"
import { QdrantVectorStore } from "../services/code-index/vector-store/qdrant-client"
import { codeParser } from "../services/code-index/worker-utils/parser"
import { EmbedderProvider, getDefaultModelId, getModelDimension } from "../shared/embeddingModels"
import { QDRANT_CODE_BLOCK_NAMESPACE } from "../services/code-index/constants"
import {
	generateNormalizedAbsolutePath,
	generateRelativeFilePath,
} from "../services/code-index/worker-utils/get-relative-path"

class IndexingWorker {
	private config: WorkerInitConfig | null = null
	private stateManager: CodeIndexStateManager | null = null
	private cacheManager: CacheManager | null = null
	private scanner: DirectoryScanner | null = null
	private fileWatcher: FileWatcher | null = null
	private embedder: any = null
	private vectorStore: any = null
	private rooIgnoreController: RooIgnoreController | null = null

	constructor() {
		if (!parentPort) {
			throw new Error("This file must be run as a worker thread")
		}

		parentPort.on("message", this.handleMessage.bind(this))
	}

	private async handleMessage(message: WorkerMessage<WorkerCommand>) {
		const { id, payload } = message

		try {
			switch (payload.type) {
				case "initialize":
					await this.initialize(payload.config)
					this.sendResponse(id, { type: "initialized", success: true })
					break

				case "start":
					await this.startIndexing()
					this.sendResponse(id, {
						type: "status",
						state: "Indexed",
						message: "Indexing completed successfully",
					})
					break

				case "stop":
					await this.stopIndexing()
					this.sendResponse(id, { type: "stopped", success: true })
					break

				case "clear":
					await this.clearIndex()
					this.sendResponse(id, { type: "cleared", success: true })
					break

				case "search": {
					const results = await this.search(payload.query, payload.directoryPrefix)
					this.sendResponse(id, { type: "searchResult", results })
					break
				}

				default:
					this.sendResponse(id, {
						type: "error",
						error: `Unknown command type: ${(payload as any).type}`,
					})
			}
		} catch (error) {
			console.error("[IndexingWorker] Error handling message:", error)
			this.sendResponse(id, {
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private async initialize(config: WorkerInitConfig) {
		this.config = config

		try {
			// Validate required configuration
			if (!config.workspacePath || config.workspacePath.trim() === "") {
				throw new Error("Workspace path is required for indexing")
			}

			// Initialize state manager
			this.stateManager = new CodeIndexStateManager()

			// Set up state change listeners to forward to main thread
			this.stateManager.onProgressUpdate((status) => {
				// Send progress updates based on the current unit
				if (status.currentItemUnit === "files") {
					this.sendResponse("progress", {
						type: "progress",
						processedInBatch: status.processedItems,
						totalInBatch: status.totalItems,
						currentFile: status.message.includes("Current:")
							? status.message.split("Current: ")[1]
							: undefined,
					})
				} else if (status.currentItemUnit === "blocks") {
					this.sendResponse("blockProgress", {
						type: "blockProgress",
						blocksIndexed: status.processedItems,
						totalBlocks: status.totalItems,
					})
				}

				// Always send status updates
				this.sendResponse("status", {
					type: "status",
					state: status.systemStatus,
					message: status.message,
				})
			})

			// Initialize cache manager
			this.cacheManager = new CacheManager(
				{ globalStorageUri: { fsPath: config.contextPath } },
				config.workspacePath,
			)
			await this.cacheManager.initialize()

			// Initialize embedder based on config
			this.embedder = this.createEmbedder(config)

			// Initialize vector store
			this.vectorStore = this.createVectorStore(config)

			// Initialize RooIgnoreController
			this.rooIgnoreController = new RooIgnoreController(config.workspacePath)
			await this.rooIgnoreController.initialize()

			// Initialize scanner
			this.scanner = new DirectoryScanner(config.workspacePath)

			// Initialize file watcher
			this.fileWatcher = new FileWatcher(config.workspacePath, {
				excludePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/out/**"],
			})
		} catch (error) {
			console.error("[IndexingWorker] Initialization error:", error)
			throw error
		}
	}

	private createEmbedder(config: WorkerInitConfig): any {
		const provider = config.embedderProvider as EmbedderProvider

		if (provider === "openai") {
			if (!config.embedderApiKey) {
				throw new Error("OpenAI API key missing for embedder creation")
			}
			return new OpenAiEmbedder({
				openAiNativeApiKey: config.embedderApiKey,
				openAiNativeBaseUrl: config.embedderBaseUrl,
				openAiEmbeddingModelId: config.embedderModelId || getDefaultModelId(provider),
			})
		} else if (provider === "ollama") {
			if (!config.embedderBaseUrl) {
				throw new Error("Ollama base URL missing for embedder creation")
			}
			return new CodeIndexOllamaEmbedder({
				ollamaBaseUrl: config.embedderBaseUrl,
				ollamaModelId: config.embedderModelId || getDefaultModelId(provider),
			})
		} else if (provider === "openai-compatible") {
			if (!config.embedderBaseUrl || !config.embedderApiKey) {
				throw new Error("OpenAI Compatible configuration missing for embedder creation")
			}
			return new OpenAICompatibleEmbedder(
				config.embedderBaseUrl,
				config.embedderApiKey,
				config.embedderModelId || getDefaultModelId(provider),
			)
		}

		throw new Error(`Invalid embedder type configured: ${provider}`)
	}

	private createVectorStore(config: WorkerInitConfig): any {
		const provider = config.embedderProvider as EmbedderProvider
		const defaultModel = getDefaultModelId(provider)
		const modelId = config.embedderModelId || defaultModel

		let vectorSize: number | undefined

		if (provider === "openai-compatible") {
			// For openai-compatible, we need to get the dimension from somewhere
			// Default to 1536 for now (OpenAI's dimension)
			vectorSize = 1536
		} else {
			vectorSize = getModelDimension(provider, modelId)
		}

		if (vectorSize === undefined) {
			throw new Error(`Could not determine vector dimension for model '${modelId}' with provider '${provider}'`)
		}

		if (!config.qdrantUrl) {
			throw new Error("Qdrant URL missing for vector store creation")
		}

		return new QdrantVectorStore(config.workspacePath, config.qdrantUrl, vectorSize)
	}

	private async startIndexing() {
		if (
			!this.config ||
			!this.stateManager ||
			!this.scanner ||
			!this.embedder ||
			!this.vectorStore ||
			!this.cacheManager
		) {
			throw new Error("Worker not initialized")
		}

		this.stateManager.setSystemState("Indexing", "Initializing services...")

		try {
			// Initialize vector store
			const collectionCreated = await this.vectorStore.initialize()
			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")

			// Perform the scan
			const scanResult = await this.scanner.scan((processed, total) => {
				this.stateManager!.reportFileQueueProgress(processed, total)
			})

			// Process files for indexing
			let totalBlocksIndexed = 0
			const batchSize = 50
			const files = scanResult.files

			for (let i = 0; i < files.length; i += batchSize) {
				const batch = files.slice(i, i + batchSize)
				const blocks = []

				for (const filePath of batch) {
					try {
						// Check if file should be indexed
						if (this.rooIgnoreController?.isIgnored(filePath)) {
							continue
						}

						// Read file content
						const content = await fs.readFile(filePath, "utf8")

						// Calculate hash
						const fileHash = createHash("sha256").update(content).digest("hex")

						// Check cache
						const cachedHash = this.cacheManager.getHash(filePath)
						if (cachedHash === fileHash) {
							continue
						}

						// Parse file
						const fileBlocks = await codeParser.parseFile(filePath, { content, fileHash })
						blocks.push(...fileBlocks)

						// Update cache
						this.cacheManager.updateHash(filePath, fileHash)
					} catch (error) {
						console.error(`Error processing file ${filePath}:`, error)
					}
				}

				// Create embeddings and store in vector store
				if (blocks.length > 0) {
					const texts = blocks.map((block) => block.content.trim()).filter((text) => text.length > 0)
					if (texts.length > 0) {
						const { embeddings } = await this.embedder.createEmbeddings(texts)

						// Prepare points for vector store
						const points = blocks.map((block, index) => {
							const normalizedAbsolutePath = generateNormalizedAbsolutePath(
								block.file_path,
								this.config!.workspacePath,
							)
							const stableName = `${normalizedAbsolutePath}:${block.start_line}`
							const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE)

							return {
								id: pointId,
								vector: embeddings[index],
								payload: {
									filePath: generateRelativeFilePath(
										normalizedAbsolutePath,
										this.config!.workspacePath,
									),
									codeChunk: block.content,
									startLine: block.start_line,
									endLine: block.end_line,
								},
							}
						})

						await this.vectorStore.upsertPoints(points)
						totalBlocksIndexed += blocks.length

						this.stateManager.reportBlockIndexingProgress(totalBlocksIndexed, scanResult.totalFiles)
					}
				}
			}

			// Start file watcher
			if (this.fileWatcher) {
				this.fileWatcher.onFileChange(async (event) => {
					// TODO: Implement file change handling
				})
				this.fileWatcher.start()
			}

			this.stateManager.setSystemState("Indexed", "Indexing complete. File watcher started.")
		} catch (error) {
			console.error("Error during indexing:", error)
			this.stateManager.setSystemState(
				"Error",
				`Indexing failed: ${error instanceof Error ? error.message : String(error)}`,
			)
			throw error
		}
	}

	private async stopIndexing() {
		if (this.fileWatcher) {
			await this.fileWatcher.stop()
		}
		if (this.stateManager) {
			this.stateManager.setSystemState("Standby", "Indexing stopped")
		}
	}

	private async clearIndex() {
		if (!this.vectorStore || !this.cacheManager) {
			throw new Error("Worker not initialized")
		}

		await this.vectorStore.deleteCollection()
		await this.cacheManager.clearCacheFile()

		if (this.stateManager) {
			this.stateManager.setSystemState("Standby", "Index cleared")
		}
	}

	private async search(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.embedder || !this.vectorStore) {
			throw new Error("Worker not initialized")
		}

		// Create embedding for query
		const { embeddings } = await this.embedder.createEmbeddings([query])
		const queryVector = embeddings[0]

		// Search in vector store
		const results = await this.vectorStore.search(queryVector, 10, this.config?.searchMinScore || 0.7)

		// Filter by directory prefix if provided
		if (directoryPrefix) {
			return results.filter(
				(result: VectorStoreSearchResult) => result.payload?.filePath?.startsWith(directoryPrefix) ?? false,
			)
		}

		return results
	}

	private sendResponse(id: string, response: WorkerResponse) {
		if (parentPort) {
			const message: WorkerMessage<WorkerResponse> = { id, payload: response }
			parentPort.postMessage(message)
		}
	}
}

// Start the worker
try {
	new IndexingWorker()
} catch (error) {
	console.error("[IndexingWorker] Failed to create IndexingWorker:", error)
	process.exit(1)
}
