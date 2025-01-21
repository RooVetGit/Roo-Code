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
