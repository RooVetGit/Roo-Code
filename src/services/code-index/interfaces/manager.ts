import { VectorStoreSearchResult } from "./vector-store"
import { ApiHandlerOptions } from "../../../shared/api"
import * as vscode from "vscode"

/**
 * Interface for the code index manager
 */
export interface ICodeIndexManager {
	/**
	 * Event emitted when progress is updated
	 */
	onProgressUpdate: vscode.Event<{
		systemStatus: IndexingState
		fileStatuses: Record<string, string>
		message?: string
	}>

	/**
	 * Current state of the indexing process
	 */
	readonly state: IndexingState

	/**
	 * Loads configuration from storage
	 */
	loadConfiguration(): Promise<void>

	/**
	 * Updates configuration
	 * @param config Configuration options
	 */
	updateConfiguration(config: { openAiOptions?: ApiHandlerOptions; qdrantUrl?: string }): void

	/**
	 * Starts the indexing process
	 */
	startIndexing(): Promise<void>

	/**
	 * Stops the file watcher
	 */
	stopWatcher(): void

	/**
	 * Clears the index
	 */
	clearIndex(): Promise<void>

	/**
	 * Searches the index
	 * @param query Query string
	 * @param limit Maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	searchIndex(query: string, limit: number): Promise<VectorStoreSearchResult[]>

	/**
	 * Sets the webview provider for status updates
	 * @param provider Webview provider
	 */
	setWebviewProvider(provider: { postMessage: (msg: any) => void }): void
}

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"
export type EmbedderType = "openai" | "ollama"

export interface IndexProgressUpdate {
	systemStatus: IndexingState
	message?: string
}
