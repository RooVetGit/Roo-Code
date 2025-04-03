
function _me(e, t = "", r = !0, n = "", i = 0, s = 3) {
	if (i > s) return ""
	let o = []
	if (n) {
		let c = e.isDirectory ? `${n}/` : n
		o.push(`${t}${r ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}${c}`)
	}
	let a = t + (r ? "    " : "\u2502   "),
		l = Array.from(e.children.entries()).sort(([c], [u]) => c.localeCompare(u))
	return (
		l.forEach(([c, u], f) => {
			let p = f === l.length - 1,
				g = _me(u, a, p, c, i + 1, s)
			g && o.push(g)
		}),
		o.join(`
`)
	)
}