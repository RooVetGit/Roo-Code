
function kbe(e, t, r) {
	let n = v0t(),
		i = Ri.window.createTextEditorDecorationType({
			backgroundColor: n.added.background,
			isWholeLine: !0,
			after: { color: n.added.text, margin: "0 0 0 1em" },
		}),
		s = Ri.window.createTextEditorDecorationType({
			isWholeLine: !0,
			before: {
				color: n.removed.text,
				border: `1px solid ${n.removed.border}`,
				backgroundColor: n.removed.background,
				margin: "0 5px 0 0",
			},
		}),
		o = mI("original", "modified", t, r, "", "", { context: 0 }),
		a = [],
		l = []
	for (let u of o.hunks) {
		let f = u.newStart - 1,
			p = !1,
			g = 0,
			m = ""
		for (let y of u.lines)
			if (y.startsWith("+")) {
				if (f < e.document.lineCount) {
					let C = new Ri.Range(new Ri.Position(f, 0), new Ri.Position(f, e.document.lineAt(f).text.length))
					a.push(C)
				}
				f++
			} else
				y.startsWith("-") &&
					((p = !0),
					g++,
					(m +=
						y.substring(1) +
						`
`))
		if (p) {
			let y = Math.max(0, u.newStart - 2)
			if (y < e.document.lineCount) {
				let C = new Ri.Range(new Ri.Position(y, 0), new Ri.Position(y, e.document.lineAt(y).text.length))
				l.push({ range: C, count: g, removedContent: m.trim() })
			}
		}
	}
	e.setDecorations(i, a)
	let c = l.map((u) => {
		let f = new Ri.MarkdownString()
		return (
			f.appendMarkdown(`**Removed content:**

`),
			f.appendCodeblock(u.removedContent, "diff"),
			(f.isTrusted = !0),
			(f.supportHtml = !0),
			{
				range: u.range,
				renderOptions: {
					before: {
						contentText: `\u2296 ${u.count} line${u.count === 1 ? "" : "s"} removed`,
						color: n.removed.text,
						border: `1px solid ${n.removed.border}`,
						backgroundColor: n.removed.background,
						margin: "0 5px 0 0",
					},
				},
				hoverMessage: f,
			}
		)
	})
	return e.setDecorations(s, c), [i, s]
}