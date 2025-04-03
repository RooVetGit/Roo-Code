
function B_e(e, t, r, n, i) {
	let s = r ? -1 : 1
	if (e.length === 0) return
	let o = Ie.window.activeTextEditor
	if (!o) return
	let a = o.selection
	if (!a) return
	let l = $u(a),
		c = e.filter((f) => f.qualifiedPathName.equals(o.document.uri) && (!n || !f.equals(t)))
	if (c.length === 0 && i)
		return e
			.filter((f) => !n || !f.equals(t))
			.filter((f) => f.scope === "WORKSPACE")
			.reduce((f, p) => (f != null && f.result.localizationScore > p.result.localizationScore ? f : p), void 0)
	n && (c = c.filter((f) => !f.equals(t)))
	let u = c.sort((f, p) => s * f.highlightRange.compareTo(p.highlightRange))
	return t
		? (u.find((f) => s * f.highlightRange.compareTo(t.highlightRange) > 0) ?? u[0])
		: (u.find(
				(f) =>
					s * f.highlightRange.compareTo(l) >= 0 ||
					f.previewBoxRange(o.document).contains(a.active.line) ||
					f.previewBoxRange(o.document).contains(a.anchor.line),
			) ?? u[0])
}