
function Rx(e) {
	return {
		startLineNumber: e.start.line,
		startColumn: e.start.character,
		endLineNumber: e.end.line,
		endColumn: e.end.character,
	}
}