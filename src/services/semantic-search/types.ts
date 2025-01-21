export interface CodeDefinition {
	content: string
	filePath: string
	type: string
	name: string
	startLine: number
	endLine: number
}

export interface Storage {
	get<T>(key: string): T | undefined
	update(key: string, value: any): Thenable<void>
}
