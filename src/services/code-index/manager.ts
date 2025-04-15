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

export class CodeIndexManager {
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	// Specialized class instances
	private readonly _configManager: CodeIndexConfigManager
	private readonly _stateManager: CodeIndexStateManager
	private readonly _serviceFactory: CodeIndexServiceFactory
	private readonly _orchestrator: CodeIndexOrchestrator
	private readonly _searchService: CodeIndexSearchService

	public static getInstance(context: vscode.ExtensionContext, contextProxy?: ContextProxy): CodeIndexManager {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now
		if (!workspacePath) {
			throw new Error("Cannot get CodeIndexManager instance without an active workspace.")
		}

		if (!CodeIndexManager.instances.has(workspacePath) && contextProxy) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context, contextProxy))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		CodeIndexManager.instances.forEach((instance) => instance.dispose())
		CodeIndexManager.instances.clear()
	}

	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext, contextProxy: ContextProxy) {
		this.workspacePath = workspacePath
		this.context = context

		// Initialize state manager first since other components depend on it
		this._stateManager = new CodeIndexStateManager()

		// Initialize remaining specialized classes
		this._configManager = new CodeIndexConfigManager(contextProxy)
		this._serviceFactory = new CodeIndexServiceFactory(this._configManager, workspacePath)
		this._orchestrator = new CodeIndexOrchestrator(
			this._configManager,
			this._stateManager,
			this._serviceFactory,
			context,
			workspacePath,
		)
		this._searchService = new CodeIndexSearchService(
			this._configManager,
			this._stateManager,
			this._serviceFactory,
			context,
		)
	}

	// --- Public API ---

	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	public get state(): IndexingState {
		return this._orchestrator.state
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager.isFeatureEnabled
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager.isFeatureConfigured
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<void> {
		const { requiresRestart } = await this._configManager.loadConfiguration()
		if (requiresRestart) {
			await this.startIndexing()
		}
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		await this._orchestrator.startIndexing()
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		this._orchestrator.stopWatcher()
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		this.stopWatcher()
		this._stateManager.dispose()
		console.log(`[CodeIndexManager] Disposed for workspace: ${this.workspacePath}`)
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		await this._orchestrator.clearIndexData()
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public setWebviewProvider(provider: { postMessage: (msg: any) => void }) {
		this._stateManager.setWebviewProvider(provider)
	}

	public async searchIndex(query: string, limit: number): Promise<VectorStoreSearchResult[]> {
		return this._searchService.searchIndex(query, limit)
	}
}
