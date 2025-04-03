
async function n0e(e) {
	let [t, r, n] = await Promise.all([
		Da.commands.executeCommand("vscode.provideDocumentSemanticTokensLegend", e),
		Da.commands.executeCommand("vscode.provideDocumentSemanticTokens", e),
		ho(e),
	])
	if (!t || !r || !n) return []
	let i = [],
		s = r.data
	for (let o = 0; o < s.length; o += 5) {
		let a = i[i.length - 1],
			l = s[o],
			c = s[o + 1],
			u = s[o + 2],
			f = (a?.range.startLineNumber ?? 0) + l,
			g = (l === 0 ? (a?.range.startColumn ?? 0) : 0) + c,
			m = new Da.Position(f, g),
			C = n.offsetAt(m) + u,
			v = n.positionAt(C),
			b = new Da.Range(m, v),
			w = n.getText(b)
		i.push({
			name: w,
			kind: Da.SymbolKind.String,
			range: Rx(b),
			selectionRange: Rx(b),
			detail: "",
			tags: [],
			children: [],
		})
	}
	return i
}