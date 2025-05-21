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
		if (!this.isFeatureEnabled) {
			return "Standby"
		}
		this.assertInitialized()
		return this._orchestrator!.state
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager?.isFeatureConfigured ?? false
	}

	public get isInitialized(): boolean {
		try {
			this.assertInitialized()
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * Initializes the manager with configuration and dependent services.
	 * Must be called before using any other methods.
	 * @returns Object indicating if a restart is needed
	 */
	public async initialize(contextProxy: ContextProxy): Promise<{ requiresRestart: boolean }> {
		// 1. ConfigManager Initialization and Configuration Loading
		this._configManager = new CodeIndexConfigManager(contextProxy)
		const { requiresRestart, requiresClear } = await this._configManager.loadConfiguration()

		// 2. Check if feature is enabled
		if (!this.isFeatureEnabled) {
			console.log("[CodeIndexManager] Feature disabled - skipping service initialization")
			if (this._orchestrator) {
				this._orchestrator.stopWatcher()
			}
			return { requiresRestart }
		}

		// 3. CacheManager Initialization
		if (!this._cacheManager) {
			this._cacheManager = new CacheManager(this.context, this.workspacePath)
			await this._cacheManager.initialize()
		}

		// 4. Determine if Core Services Need Recreation
		const needsServiceRecreation = !this._serviceFactory || requiresRestart
		console.log(
			`[CodeIndexManager] ${needsServiceRecreation ? "Initial setup or restart required" : "Configuration loaded, no full re-initialization needed"}`,
		)

		if (needsServiceRecreation) {
			console.log("[CodeIndexManager] (Re)initializing core services...")

			// Stop watcher if it exists
			if (this._orchestrator) {
				this.stopWatcher()
				console.log("[CodeIndexManager] Stopped existing watcher")
			}

			// (Re)Initialize service factory
			this._serviceFactory = new CodeIndexServiceFactory(
				this._configManager,
				this.workspacePath,
				this._cacheManager,
			)

			// (Re)Create shared service instances
			const { embedder, vectorStore, scanner, fileWatcher } = this._serviceFactory.createServices(
				this.context,
				this._cacheManager,
			)

			// (Re)Initialize orchestrator
			this._orchestrator = new CodeIndexOrchestrator(
				this._configManager,
				this._stateManager,
				this.workspacePath,
				this._cacheManager,
				vectorStore,
				scanner,
				fileWatcher,
			)

			// (Re)Initialize search service
			this._searchService = new CodeIndexSearchService(
				this._configManager,
				this._stateManager,
				embedder,
				vectorStore,
			)

			console.log("[CodeIndexManager] Core services (re)initialized")
		}

		// 5. Handle Data Clearing
		if (requiresClear) {
			console.log("[CodeIndexManager] Configuration requires clearing data")
			if (this._orchestrator) {
				await this._orchestrator.clearIndexData()
			}
			if (this._cacheManager) {
				await this._cacheManager.clearCacheFile()
			}
		}

		// Handle Indexing Start/Restart
		const shouldStartOrRestartIndexing =
			requiresRestart ||
			requiresClear ||
			(needsServiceRecreation && (!this._orchestrator || this._orchestrator.state !== "Indexing"))

		if (shouldStartOrRestartIndexing) {
			console.log("[CodeIndexManager] Starting/restarting indexing due to configuration changes")
			this._orchestrator?.startIndexing() // This method is async, but we don't await it here
		}

		return { requiresRestart }
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		if (!this.isFeatureEnabled) {
			console.log("[CodeIndexManager] Feature disabled - skipping startIndexing")
			return
		}
		this.assertInitialized()
		await this._orchestrator!.startIndexing()
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		if (!this.isFeatureEnabled) {
			console.log("[CodeIndexManager] Feature disabled - skipping stopWatcher")
			return
		}
		if (this._orchestrator) {
			this._orchestrator.stopWatcher()
		}
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
		if (!this.isFeatureEnabled) {
			console.log("[CodeIndexManager] Feature disabled - skipping clearIndexData")
			return
		}
		this.assertInitialized()
		await this._orchestrator!.clearIndexData()
		await this._cacheManager!.clearCacheFile()
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.isFeatureEnabled) {
			console.log("[CodeIndexManager] Feature disabled - returning empty search results")
			return []
		}
		this.assertInitialized()
		return this._searchService!.searchIndex(query, directoryPrefix)
	}
}
