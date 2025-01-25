export interface CodeSegment {
	type: "function" | "class" | "method" | "variable" | "other"
	name: string
	content: string
	context?: string // parent class/module/namespace if any
	startLine: number
	endLine: number
	importance: number // semantic weight (0-1)
	language: string
	docstring?: string
	params?: Array<{ name: string; type?: string }>
	returnType?: string
	relationships?: {
		imports: string[]
		inheritedFrom?: string
		implementedInterfaces?: string[]
		usedIn: string[]
		dependencies: string[]
	}
}

export interface ParsedFile {
	path: string
	segments: CodeSegment[]
	imports: string[]
	exports: string[]
	summary: string
}

export interface SemanticParser {
	parseFile(filePath: string): Promise<ParsedFile>
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
