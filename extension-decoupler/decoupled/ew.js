
function EW(e, t, r, n) {
	if (!e) return null
	let { document: i, selection: s } = e,
		o = t.safeResolvePathName(i.uri)
	if (!o) return X("getSelectedCodeDetails").error("Unable to resolve path name for document"), null
	let a = i.languageId,
		l = i.lineAt(0).range.start,
		c = i.lineAt(i.lineCount - 1).range.end,
		u = i.getText(s),
		f,
		p
	if (u.trim() === "") {
		let y = new Di.Position(s.active.line + 1, 0)
		;(f = new Di.Range(l, y)), (p = new Di.Range(y, c))
	} else (f = new Di.Range(l, s.start)), (p = new Di.Range(s.end, c))
	var g = i.getText(f),
		m = i.getText(p)
	return (
		g.length > r && (g = g.slice(g.length - r)),
		m.length > n && (m = m.slice(0, n)),
		m.trim() === "" && ((u += m), (m = "")),
		{
			selectedCode: u,
			prefix: g,
			suffix: m,
			path: o.relPath,
			language: a,
			prefixBegin: f.start.character,
			suffixEnd: p.end.character,
		}
	)
}