
async function i0e(e, t) {
	let r = Da.Uri.file(Sk(e)),
		n = await ho(r)
	if (!n) return Promise.resolve([])
	let i = e.fullRange ? kx(e.fullRange) : void 0,
		s = i ? n.offsetAt(i.start) : 0,
		o = n.getText(i),
		a = new RegExp(`\\b${t}\\b`, "g"),
		l = o.search(a)
	if (l >= 0) {
		let c = n.positionAt(s + l),
			u = n.positionAt(s + l + t.length),
			f = new Da.Range(c, u)
		return Promise.resolve([
			{
				name: n.getText(f),
				kind: Da.SymbolKind.String,
				range: Rx(f),
				selectionRange: Rx(f),
				detail: "",
				tags: [],
				children: [],
			},
		])
	}
	return Promise.resolve([])
}