export enum CodeSegmentType {
	FUNCTION = "function",
	CLASS = "class",
	METHOD = "method",
	VARIABLE = "variable",
	IMPORT = "import",
	OTHER = "other",
}

export interface CodeSegment {
	type: CodeSegmentType
	name: string
	content: string
	startLine: number
	endLine: number
	context: string
	importance: number
	language: string
}

export interface ParsedFile {
	path: string
	segments: CodeSegment[]
	imports: string[]
	exports: string[]
	summary: string
}

export interface SemanticParser {
	parseFile(filePath: string): Promise<ParsedFile | null>
	getImportGraph(filePath: string): Promise<{ imports: string[]; importedBy: string[] }>
	getSymbolContext(filePath: string, line: number, column: number): Promise<string>
}

// Importance weights for different code elements
export const IMPORTANCE_WEIGHTS = {
	CLASS: 1.0,
	INTERFACE: 0.9,
	FUNCTION: 0.8,
	METHOD: 0.7,
	ENUM: 0.6,
	TYPE: 0.5,
	MODULE: 0.9,
} as const
