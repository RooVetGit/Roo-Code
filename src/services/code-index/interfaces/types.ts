/**
 * Common types used across the code-index service
 */

export interface CodeBlock {
	file_path: string
	identifier: string | null
	type: string
	start_line: number
	end_line: number
	content: string
	fileHash: string
	segmentHash: string
}

export interface Payload {
	filePath: string
	codeChunk: string
	startLine: number
	endLine: number
	[key: string]: any
}

export interface QdrantSearchResult {
	id: string | number
	score: number
	payload?: Payload | null
}

export interface EmbeddingResponse {
	embeddings: number[][]
	usage: {
		prompt_tokens: number
		total_tokens: number
	}
}

export interface FileProcessingResult {
	path: string
	status: "success" | "skipped" | "error"
	error?: Error
	reason?: string
}

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

export interface IndexProgressUpdate {
	systemStatus: IndexingState
	message?: string
}
