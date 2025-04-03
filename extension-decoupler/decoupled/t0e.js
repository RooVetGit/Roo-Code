
async function t0e(e, t) {
	let r = await ho(Ba.Uri.file(Bs(e))),
		n = new Ba.Range(r.positionAt(t.charStart), r.positionAt(t.charEnd))
	return {
		repoRoot: e.rootPath,
		pathName: e.relPath,
		fullRange: {
			startLineNumber: n.start.line,
			startColumn: n.start.character,
			endLineNumber: n.end.line,
			endColumn: n.end.character,
		},
	}
}