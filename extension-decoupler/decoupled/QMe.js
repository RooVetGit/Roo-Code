
function qme(e, t) {
	let r = { type: "file-ranges-selected", data: [] }
	if (!e || !t) return r
	let n = jut(e.document.uri, t),
		i = e.selections
	return (
		n &&
			i.some((s) => !s.isEmpty) &&
			(r.data = i.map((s) => ({
				repoRoot: n.repoRoot,
				pathName: n.pathName,
				fullRange: {
					startLineNumber: s.start.line,
					startColumn: s.start.character,
					endLineNumber: s.end.line,
					endColumn: s.end.character,
				},
				originalCode: e.document.getText(s),
			}))),
		r
	)
}