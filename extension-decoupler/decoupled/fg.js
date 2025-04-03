
function fG(e, t, r, n = Lpt()) {
	let i = (e && `[${e}]`) || "",
		s = [],
		o = typeof t == "string" ? n.extend(t) : t,
		a = Upt(Pu(t, $s), o, n)
	return c(r)
	function l(u, f) {
		return Qr(s, fG(e, a.replace(/^[^:]+/, u), f, n))
	}
	function c(u) {
		let f = (u && `[${u}]`) || "",
			p = (o && MCe(o, f)) || nA,
			g = MCe(n, `${i} ${f}`, p)
		return Object.assign(o ? p : g, { label: e, sibling: l, info: g, step: c })
	}
}