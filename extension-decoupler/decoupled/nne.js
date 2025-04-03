
function NNe(e, t) {
	for (
		var r = /(\n+)([^\n]*)/g,
			n = (function () {
				var c = e.indexOf(`
`)
				return (c = c !== -1 ? c : e.length), (r.lastIndex = c), eK(e.slice(0, c), t)
			})(),
			i =
				e[0] ===
					`
` || e[0] === " ",
			s,
			o;
		(o = r.exec(e));

	) {
		var a = o[1],
			l = o[2]
		;(s = l[0] === " "),
			(n +=
				a +
				(!i && !s && l !== ""
					? `
`
					: "") +
				eK(l, t)),
			(i = s)
	}
	return n
}