import { CodeSegment } from "./parser/types"
import { Vector } from "./vector-store/types"

export interface CodeDefinition {
	type: string
	name: string
	content: string
	filePath: string
	startLine: number
	endLine: number
	language: string
	context?: string
	docstring?: string
	params?: Array<{ name: string; type?: string }>
	returnType?: string
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
		docstring: segment.docstring,
		params: segment.params,
		returnType: segment.returnType,
	}
}

export type SearchResultType = "file" | "code"

export interface BaseSearchResult {
	score: number
}

export interface FileSearchResult {
	type: "file"
	filePath: string
	vector: Vector
	score: number
	name: string
	metadata: CodeDefinition
}

export interface CodeSearchResult {
	type: "code"
	filePath: string
	content: string
	startLine: number
	endLine: number
	name: string
	codeType: string
	vector: Vector
	score: number
	metadata: CodeDefinition
}

export type SearchResult = FileSearchResult | CodeSearchResult
