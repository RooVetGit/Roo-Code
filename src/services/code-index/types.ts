export interface QdrantSearchResult {
	id: string | number
	score: number
	payload?: Payload | null
}

export interface Payload extends Record<string, any> {
	filePath: string
	codeChunk: string
	startLine: number
	endLine: number
}
