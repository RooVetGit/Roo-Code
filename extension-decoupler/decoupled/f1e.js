
function F1e(e, t) {
	if (((t = Object.create(t || null)), !e.buffer)) return null
	t.maxLength || (t.maxLength = 79),
		typeof t.indent != "number" && (t.indent = 1),
		typeof t.linesBefore != "number" && (t.linesBefore = 3),
		typeof t.linesAfter != "number" && (t.linesAfter = 2)
	for (var r = /\r?\n|\r|\0/g, n = [0], i = [], s, o = -1; (s = r.exec(e.buffer)); )
		i.push(s.index), n.push(s.index + s[0].length), e.position <= s.index && o < 0 && (o = n.length - 2)
	o < 0 && (o = n.length - 1)
	var a = "",
		l,
		c,
		u = Math.min(e.line + t.linesAfter, i.length).toString().length,
		f = t.maxLength - (t.indent + u + 3)
	for (l = 1; l <= t.linesBefore && !(o - l < 0); l++)
		(c = DP(e.buffer, n[o - l], i[o - l], e.position - (n[o] - n[o - l]), f)),
			(a =
				Ui.repeat(" ", t.indent) +
				TP((e.line - l + 1).toString(), u) +
				" | " +
				c.str +
				`
` +
				a)
	for (
		c = DP(e.buffer, n[o], i[o], e.position, f),
			a +=
				Ui.repeat(" ", t.indent) +
				TP((e.line + 1).toString(), u) +
				" | " +
				c.str +
				`
`,
			a +=
				Ui.repeat("-", t.indent + u + 3 + c.pos) +
				`^
`,
			l = 1;
		l <= t.linesAfter && !(o + l >= i.length);
		l++
	)
		(c = DP(e.buffer, n[o + l], i[o + l], e.position - (n[o] - n[o + l]), f)),
			(a +=
				Ui.repeat(" ", t.indent) +
				TP((e.line + l + 1).toString(), u) +
				" | " +
				c.str +
				`
`)
	return a.replace(/\n$/, "")
}