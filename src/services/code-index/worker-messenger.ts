import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"

// Command messages sent from main thread to worker
export type WorkerCommand =
	| { type: "start" }
	| { type: "stop" }
	| { type: "clear" }
	| { type: "search"; query: string; directoryPrefix?: string }
	| { type: "initialize"; config: WorkerInitConfig }

// Response messages sent from worker to main thread
export type WorkerResponse =
	| { type: "progress"; processedInBatch: number; totalInBatch: number; currentFile?: string }
	| { type: "status"; state: IndexingState; message: string }
	| { type: "searchResult"; results: VectorStoreSearchResult[] }
	| { type: "error"; error: string }
	| { type: "initialized"; success: boolean }
	| { type: "stopped"; success: boolean }
	| { type: "cleared"; success: boolean }
	| { type: "blockProgress"; blocksIndexed: number; totalBlocks: number }

// Configuration passed to worker on initialization
export interface WorkerInitConfig {
	workspacePath: string
	contextPath: string
	isFeatureEnabled: boolean
	isFeatureConfigured: boolean
	// Add other necessary config from CodeIndexConfigManager
	qdrantUrl?: string
	embedderProvider?: string
	embedderBaseUrl?: string
	embedderModelId?: string
	embedderApiKey?: string
	searchMinScore?: number
}

// Message wrapper for type safety
export interface WorkerMessage<T = WorkerCommand | WorkerResponse> {
	id: string
	payload: T
}
