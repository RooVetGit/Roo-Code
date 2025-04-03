
async function ho(e) {
	let t
	if ((typeof e == "string" ? (t = wc.Uri.file(e)) : (t = e), !fW || t.scheme !== "file"))
		return wc.workspace.openTextDocument(t)
	let r = t.toString()
	for (let n of wc.workspace.textDocuments) if (n.uri.scheme === t.scheme && n.uri.toString() === r) return new wx(n)
	return new Promise((n, i) => {
		let s = wc.workspace.onDidOpenTextDocument((o) => {
			o.uri.scheme === t.scheme && o.uri.toString() === r && (s.dispose(), n(new wx(o)))
		})
		wc.workspace.openTextDocument(t.with({ scheme: gme })).then(
			(o) => {
				s.dispose(), n(new wx(o))
			},
			(o) => {
				s.dispose(), i(o)
			},
		)
	})
}