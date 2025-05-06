import * as vscode from "vscode"
import { getWorkspacePath } from "../../utils/path"
import { ContextProxy } from "../../core/config/ContextProxy"
import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { CodeIndexServiceFactory } from "./service-factory"
import { CodeIndexSearchService } from "./search-service"
import { CodeIndexOrchestrator } from "./orchestrator"
import { CacheManager } from "./cache-manager"
import { codeParser } from "./processors"

export class CodeIndexManager {
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	// Specialized class instances
	private _configManager: CodeIndexConfigManager | undefined
	private readonly _stateManager: CodeIndexStateManager
	private _serviceFactory: CodeIndexServiceFactory | undefined
	private _orchestrator: CodeIndexOrchestrator | undefined
	private _searchService: CodeIndexSearchService | undefined
	private _cacheManager: CacheManager | undefined

	public static getInstance(context: vscode.ExtensionContext): CodeIndexManager | undefined {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now

		if (!workspacePath) {
			return undefined
		}

		if (!CodeIndexManager.instances.has(workspacePath)) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		for (const instance of CodeIndexManager.instances.values()) {
			instance.dispose()
		}
		CodeIndexManager.instances.clear()
	}

	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		this._stateManager = new CodeIndexStateManager()
	}

	// --- Public API ---

	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	private assertInitialized() {
		if (!this._configManager || !this._orchestrator || !this._searchService || !this._cacheManager) {
			throw new Error("CodeIndexManager not initialized. Call initialize() first.")
		}
	}

	public get state(): IndexingState {
		this.assertInitialized()
		return this._orchestrator!.state
	}

	public get isFeatureEnabled(): boolean {
		this.assertInitialized()
		return this._configManager!.isFeatureEnabled
	}

	public get isFeatureConfigured(): boolean {
		this.assertInitialized()
		return this._configManager!.isFeatureConfigured
	}

	/**
	 * Initializes the manager with configuration and dependent services.
	 * Must be called before using any other methods.
	 * @returns Object indicating if a restart is needed
	 */
	public async initialize(contextProxy: ContextProxy): Promise<{ requiresRestart: boolean }> {
		// Initialize config manager and load configuration
		this._configManager = new CodeIndexConfigManager(contextProxy)
		const { requiresRestart, requiresClear } = await this._configManager.loadConfiguration()

		// Initialize cache manager
		this._cacheManager = new CacheManager(this.context, this.workspacePath)
		await this._cacheManager.initialize()

		// Initialize service factory and dependent services
		this._serviceFactory = new CodeIndexServiceFactory(this._configManager, this.workspacePath, this._cacheManager)

		// Create shared service instances
		const embedder = this._serviceFactory.createEmbedder()
		const vectorStore = this._serviceFactory.createVectorStore()
		const parser = codeParser
		const scanner = this._serviceFactory.createDirectoryScanner(embedder, vectorStore, parser)
		const fileWatcher = this._serviceFactory.createFileWatcher(
			this.context,
			embedder,
			vectorStore,
			this._cacheManager,
		)

		// Initialize orchestrator
		this._orchestrator = new CodeIndexOrchestrator(
			this._configManager,
			this._stateManager,
			this.context,
			this.workspacePath,
			this._cacheManager,
			embedder,
			vectorStore,
			parser,
			scanner,
			fileWatcher,
		)

		// Initialize search service
		this._searchService = new CodeIndexSearchService(this._configManager, this._stateManager, embedder, vectorStore)

		if (requiresClear) {
			console.log("[CodeIndexManager] Embedding dimension changed. Clearing existing index data...")
			await this.clearIndexData()
		}

		if (requiresRestart || requiresClear) {
			this.startIndexing()
		}

		return { requiresRestart }
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		this.assertInitialized()
		await this._orchestrator!.startIndexing()
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		this.assertInitialized()
		this._orchestrator!.stopWatcher()
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		if (this._orchestrator) {
			this.stopWatcher()
		}
		this._stateManager.dispose()
		console.log(`[CodeIndexManager] Disposed for workspace: ${this.workspacePath}`)
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		this.assertInitialized()
		await this._orchestrator!.clearIndexData()
		await this._cacheManager!.clearCacheFile()
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public setWebviewProvider(provider: { postMessage: (msg: any) => void }) {
		this._stateManager.setWebviewProvider(provider)
	}

	public async searchIndex(
		query: string,
		limit: number,
		directoryPrefix?: string,
	): Promise<VectorStoreSearchResult[]> {
		this.assertInitialized()
		return this._searchService!.searchIndex(query, limit, directoryPrefix)
	}
}
