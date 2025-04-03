
async function CW(e, t, r) {
	let n = bme(r),
		i = t()
	if (!i || e?.document.uri.fsPath !== Gn.Uri.file(i).fsPath) return
	hW !== void 0 && clearInterval(hW)
	let s = e.document.getText().replace(/^\s+/, "")
	;(s =
		`
`.repeat(AW(n)) + s),
		await e.edit((c) => {
			let u = e.document.lineAt(0),
				f = e.document.lineAt(e.document.lineCount - 1),
				p = new Gn.Range(u.range.start, f.range.end)
			c.replace(p, s)
		}),
		await e.document.save()
	let o = 0,
		a = 1e3,
		l = (0, mme.default)(() => {
			let f = n[o]
				.split(
					`
`,
				)
				.map((p, g) => ({
					range: new Gn.Range(g, 0, g, 1e4),
					renderOptions: { before: { contentText: p.replace(/ /g, "\xA0") } },
				}))
			e.setDecorations(Cme, f), (o = (o + 1) % n.length)
		}, a)
	l(), (hW = setInterval(l, a))
}