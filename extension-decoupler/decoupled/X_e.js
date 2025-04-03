
function x_e(e, t, r, n, i, s, o) {
	let a = syt(e.makeOneLineDiffSpans()),
		l = a.filter((Q) => Q.type === "updated").length - a.filter((Q) => Q.type === "original").length,
		c = (e.lineRange.stop + 2 + l).toString().length + 1,
		u
	if (s) {
		let Q =
				t?.split(`
`) ?? [],
			O =
				r?.split(`
`) ?? [],
			Y = [...Q, ...a.map((j) => j.spans.map((ne) => ne.text).join("")), ...O]
		;(u = D_.computeCommonLeadingWhitespace(Y)),
			(t = Q.map((j) => u.trimLeadingFull(j, o)).join(`
`)),
			(r = O.map((j) => u.trimLeadingFull(j, o)).join(`
`))
	} else u = D_.computeCommonLeadingWhitespace([])
	let f = n,
		{ rendered: p, longestLineLength: g } = ayt(a, f, i, e.result.truncationChar, u, o)
	t && (t = Xl(t, g)), r && (r = Xl(r, g))
	let m = SC(e.lineRange.start, c),
		y = t
			? `<span style="color:${i.lineNumberColor};">${m}${m}<span class="codicon codicon-blank"></span> ${IC(
					E_e(T_(t), g + 1),
				)}</span>
`
			: "",
		C = SC(e.lineRange.stop + 1, c),
		v = SC(e.lineRange.stop + 1 + l, c),
		b = "",
		w = ""
	b_e.default.platform() === "win32" && ((b = "<strong>"), (w = "</strong>"))
	let B = "background-color:var(--vscode-editor-background);" + (iyt() ? "border-radius:5px;" : ""),
		M = r
			? `
<span style="color:${i.lineNumberColor};">${C}${v}<span class="codicon codicon-blank"></span> ${IC(
					E_e(T_(r), g + 1),
				)}</span>`
			: ""
	return {
		result: `
${b}<pre><span style="${B}">${y}${p}${M}</span></pre>${w}
`,
		longestLineLength: g + c,
	}
}