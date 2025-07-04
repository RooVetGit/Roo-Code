import * as vscode from "vscode"
import { Worker } from "worker_threads"
import { getWorkspacePath } from "../../utils/path"
import { ContextProxy } from "../../core/config/ContextProxy"
import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { WorkerCommand, WorkerResponse, WorkerMessage, WorkerInitConfig } from "./worker-messenger"
import fs from "fs/promises"
import ignore from "ignore"
import path from "path"

export class CodeIndexManager {
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	// Specialized class instances
	private _configManager: CodeIndexConfigManager | undefined
	private readonly _stateManager: CodeIndexStateManager
	private _worker: Worker | undefined
	private _workerReady: boolean = false
	private _messageId: number = 0
	private _pendingMessages: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map()

	public static getInstance(context: vscode.ExtensionContext): CodeIndexManager | undefined {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now

		if (!workspacePath || workspacePath.trim() === "") {
			return undefined
		}

		if (!CodeIndexManager.instances.has(workspacePath)) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static async disposeAll(): Promise<void> {
		for (const instance of CodeIndexManager.instances.values()) {
			await instance.dispose()
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
		if (!this._configManager || !this._worker || !this._workerReady) {
			throw new Error("CodeIndexManager not initialized. Call initialize() first.")
		}
	}

	public get state(): IndexingState {
		if (!this.isFeatureEnabled) {
			return "Standby"
		}
		return this._stateManager.state
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
		if (!this._configManager) {
			this._configManager = new CodeIndexConfigManager(contextProxy)
		}
		// Load configuration once to get current state and restart requirements
		const { requiresRestart } = await this._configManager.loadConfiguration()

		// 2. Check if feature is enabled
		if (!this.isFeatureEnabled) {
			if (this._worker) {
				await this.stopWorker()
			}
			return { requiresRestart }
		}

		// 3. Determine if Worker Needs Recreation
		const needsWorkerRecreation = !this._worker || requiresRestart

		if (needsWorkerRecreation) {
			await this._recreateWorker()
		}

		// 4. Handle Indexing Start/Restart
		const shouldStartOrRestartIndexing =
			requiresRestart || (needsWorkerRecreation && this._stateManager.state !== "Indexing")

		if (shouldStartOrRestartIndexing) {
			await this.startIndexing()
		}

		return { requiresRestart }
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		this.assertInitialized()
		await this.sendWorkerCommand({ type: "start" })
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public async stopWatcher(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		if (this._worker) {
			await this.sendWorkerCommand({ type: "stop" })
		}
	}

	/**
	 * Cleans up the manager instance.
	 */
	public async dispose(): Promise<void> {
		await this.stopWorker()
		this._stateManager.dispose()
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		this.assertInitialized()
		await this.sendWorkerCommand({ type: "clear" })
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.isFeatureEnabled) {
			return []
		}
		this.assertInitialized()
		const response = await this.sendWorkerCommand({ type: "search", query, directoryPrefix })
		if (response.type === "searchResult") {
			return response.results
		}
		throw new Error("Unexpected response from worker")
	}

	/**
	 * Private helper method to recreate worker with current configuration.
	 * Used by both initialize() and handleSettingsChange().
	 */
	private async _recreateWorker(): Promise<void> {
		// Stop existing worker if it exists
		await this.stopWorker()

		// Create worker configuration
		const config = this._configManager!.getConfig()
		const workerConfig: WorkerInitConfig = {
			workspacePath: this.workspacePath,
			contextPath: this.context.globalStorageUri.fsPath,
			isFeatureEnabled: this._configManager!.isFeatureEnabled,
			isFeatureConfigured: this._configManager!.isFeatureConfigured,
			qdrantUrl: config.qdrantUrl,
			embedderProvider: config.embedderProvider,
			embedderBaseUrl: config.openAiCompatibleOptions?.baseUrl,
			embedderModelId: config.modelId,
			embedderApiKey: this._getEmbedderApiKey(config),
			searchMinScore: config.searchMinScore,
		}

		// Create new worker
		// Use the extension path from context to ensure we get the correct path in both dev and production
		const workerPath = path.join(this.context.extensionPath, "dist/workers/indexing-worker.js")

		try {
			this._worker = new Worker(workerPath)
		} catch (error) {
			console.error("[CodeIndexManager] Failed to create worker:", error)
			throw error
		}

		this._workerReady = false

		// Set up message handling
		this._worker.on("message", this.handleWorkerMessage.bind(this))
		this._worker.on("error", this.handleWorkerError.bind(this))
		this._worker.on("exit", this.handleWorkerExit.bind(this))

		// Initialize the worker
		const response = await this.sendWorkerCommand({ type: "initialize", config: workerConfig })

		if (response.type === "initialized" && response.success) {
			this._workerReady = true
		} else {
			throw new Error("Failed to initialize worker")
		}
	}

	private _getEmbedderApiKey(config: any): string | undefined {
		if (config.embedderProvider === "openai") {
			return config.openAiOptions?.openAiNativeApiKey
		} else if (config.embedderProvider === "openai-compatible") {
			return config.openAiCompatibleOptions?.apiKey
		}
		return undefined
	}

	private async stopWorker(): Promise<void> {
		if (this._worker) {
			// Clear pending messages
			for (const [, pending] of this._pendingMessages) {
				pending.reject(new Error("Worker stopped"))
			}
			this._pendingMessages.clear()

			// Terminate the worker
			await this._worker.terminate()
			this._worker = undefined
			this._workerReady = false
		}
	}

	private async sendWorkerCommand(command: WorkerCommand): Promise<WorkerResponse> {
		if (!this._worker) {
			throw new Error("Worker not initialized")
		}

		const id = `msg_${this._messageId++}`
		const message: WorkerMessage<WorkerCommand> = { id, payload: command }

		return new Promise((resolve, reject) => {
			// Add a timeout to detect if the worker is not responding
			const timeout = setTimeout(() => {
				this._pendingMessages.delete(id)
				reject(new Error(`Worker timeout for command: ${command.type}`))
			}, 30000)

			// Store the promise handlers with timeout cleanup
			this._pendingMessages.set(id, {
				resolve: (value) => {
					clearTimeout(timeout)
					resolve(value)
				},
				reject: (error) => {
					clearTimeout(timeout)
					reject(error)
				},
			})

			this._worker!.postMessage(message)
		})
	}

	private handleWorkerMessage(message: WorkerMessage<WorkerResponse>) {
		const { id, payload } = message

		// Handle responses to specific commands
		const pending = this._pendingMessages.get(id)
		if (pending) {
			this._pendingMessages.delete(id)
			if (payload.type === "error") {
				pending.reject(new Error(payload.error))
			} else {
				pending.resolve(payload)
			}
			return
		}

		// Handle unsolicited messages (progress updates, status changes)
		switch (payload.type) {
			case "progress":
				// File processing progress - no need to update state manager
				// as it's already updated in the worker
				break
			case "blockProgress":
				// Block indexing progress - no need to update state manager
				// as it's already updated in the worker
				break
			case "status":
				// Update local state manager to match worker state
				this._stateManager.setSystemState(payload.state, payload.message)
				break
			case "error":
				console.error("[CodeIndexManager] Worker error:", payload.error)
				this._stateManager.setSystemState("Error", payload.error)
				break
		}
	}

	private handleWorkerError(error: Error) {
		console.error("[CodeIndexManager] Worker error:", error)
		this._stateManager.setSystemState("Error", `Worker error: ${error.message}`)
	}

	private handleWorkerExit(code: number) {
		if (code !== 0) {
			console.error(`[CodeIndexManager] Worker exited with code ${code}`)
			this._stateManager.setSystemState("Error", `Worker exited unexpectedly with code ${code}`)
		}
		this._worker = undefined
		this._workerReady = false
	}

	/**
	 * Handle code index settings changes.
	 * This method should be called when code index settings are updated
	 * to ensure the CodeIndexConfigManager picks up the new configuration.
	 * If the configuration changes require a restart, the service will be restarted.
	 */
	public async handleSettingsChange(): Promise<void> {
		if (this._configManager) {
			const { requiresRestart } = await this._configManager.loadConfiguration()

			const isFeatureEnabled = this.isFeatureEnabled
			const isFeatureConfigured = this.isFeatureConfigured

			// If configuration changes require a restart and the manager is initialized, restart the service
			if (requiresRestart && isFeatureEnabled && isFeatureConfigured && this.isInitialized) {
				// Recreate worker with new configuration
				await this._recreateWorker()

				// Start indexing with new worker
				await this.startIndexing()
			}
		}
	}
}
