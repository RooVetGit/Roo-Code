
function Ime(e, t, r = !1, n = !0) {
	let i = new Dx.Position(e.start.line, 0),
		s = e.end.line
	n && e.end.character === 0 && s > e.start.line && (s -= 1)
	let o = t.lineAt(s).range.end
	return r && t.lineCount > e.end.line + 1 && (o = new Dx.Position(e.end.line + 1, 0)), new Dx.Range(i, o)
}