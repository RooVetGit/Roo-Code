
async function ZQ(e, t, r, n) {
	let i = await r.build(e, t),
		s = new Map()
	s.set("", i), s.set(".", i)
	let o = 200,
		a = Date.now(),
		l = []
	l.push([e, i])
	let c
	for (; (c = l.pop()) !== void 0; ) {
		Date.now() - a >= o && (await new Promise((C) => setTimeout(C, 0)), (a = Date.now()))
		let [f, p] = c,
			g = Yd(t, f),
			m = bx(f.fsPath),
			y = await p.buildAtop(f, m)
		y !== p && s.set(g, y)
		for (let [C, v] of m) {
			if (
				(Date.now() - a >= o && (await new Promise((Q) => setTimeout(Q, 0)), (a = Date.now())),
				C === "." || C === ".." || v !== "Directory")
			)
				continue
			let w = L8.Uri.joinPath(f, C),
				B = $t(g, C, !0)
			y.getPathInfo(B).accepted && l.push([w, y])
		}
	}
	return new N8(s, n)
}