export const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
}

export class Range {
	start: { line: number; character: number }
	end: { line: number; character: number }

	constructor(
		public startLine: number,
		public startChar: number,
		public endLine: number,
		public endChar: number,
	) {
		this.start = { line: startLine, character: startChar }
		this.end = { line: endLine, character: endChar }
	}
}

export class Diagnostic {
	constructor(
		public range: Range,
		public message: string,
		public severity: number,
		public source?: string,
	) {}
}

export const Uri = {
	file: (path: string) => ({
		path,
		fsPath: path,
		toString: () => path,
	}),
}
