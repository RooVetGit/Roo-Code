
function xme(e, t, r, n) {
	if (e.document.uri.fsPath !== r() || !t || t.document !== e.document) return
	let i = bme(n)
	if (
		!e.document.getText().startsWith(
			`
`.repeat(AW(i)),
		)
	)
		for (let s of e.contentChanges) s.range.start.line < AW(i) && CW(t, r, n)
}