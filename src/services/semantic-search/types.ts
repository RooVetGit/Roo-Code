import { CodeSegment } from "./parser/types"

export interface CodeDefinition {
	type: string
	name: string
	content: string
	filePath: string
	startLine: number
	endLine: number
	language: string
	context?: string
	contentHash?: string
}

export interface StoreSearchResult {
	score: number
	metadata: CodeDefinition
}

export interface VectorStore {
	initialize(): Promise<void>
	add(metadata: CodeDefinition, vector: number[]): Promise<void>
	addBatch(vectors: Array<{ metadata: CodeDefinition; vector: number[] }>): Promise<void>
	search(queryVector: number[], k: number): Promise<StoreSearchResult[]>
	load(): Promise<void>
	clear(): Promise<void>
	size(): number
	deleteByFilePath(filePath: string): Promise<void>
	hasFileSegments(filePath: string): Promise<{ exists: boolean; hash?: string }>
}

export interface Storage {
	get<T>(key: string): T | undefined
	update(key: string, value: any): Thenable<void>
}

export function convertSegmentToDefinition(segment: CodeSegment, filePath: string): CodeDefinition {
	return {
		type: segment.type,
		name: segment.name,
		content: segment.content,
		filePath,
		startLine: segment.startLine,
		endLine: segment.endLine,
		language: segment.language,
		context: segment.context,
	}
}

export enum SearchResultType {
	File = "file",
	Code = "code",
}

export interface SearchResultBase {
	filePath: string
	metadata: Omit<CodeDefinition, "contentHash">
}

export interface FileSearchResult extends SearchResultBase {
	type: SearchResultType.File
	name: string
}

export interface CodeSearchResult extends SearchResultBase {
	type: SearchResultType.Code
	content: string
	startLine: number
	endLine: number
	name: string
	codeType: string
}

export type SearchResult = FileSearchResult | CodeSearchResult
