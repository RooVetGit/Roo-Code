
async function bwe(e, t, r, n) {
	let i = as(e),
		s = as(t),
		o = new Array()
	o.push(i)
	let a = new Array(),
		l = 200,
		c = Date.now(),
		u
	for (; (u = o.pop()) !== void 0 && (n === void 0 || a.length < n); ) {
		Date.now() - c >= l && (await new Promise((y) => setTimeout(y, 0)), (c = Date.now()))
		let p = Yd(s, u),
			g = r.makeLocalPathFilter(p),
			m = bx(u)
		for (let [y, C] of m) {
			if (
				(Date.now() - c >= l && (await new Promise((w) => setTimeout(w, 0)), (c = Date.now())),
				y === "." || y === "..")
			)
				continue
			let b = $t(p, y, C === "Directory")
			g.acceptsPath(b, C) && (C === "File" ? a.push(b) : C === "Directory" && o.push($t(u, y)))
		}
	}
	return Promise.resolve(a)
}