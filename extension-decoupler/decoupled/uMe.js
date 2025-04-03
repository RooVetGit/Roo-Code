
function Ume(e, t, { auto: r = !0 } = {}) {
	let n = (i) => {
		let s = Object.keys(i),
			o = Gut(i)
		if (!o && s.length > 1 && !NW(i)) return n(Mme(i))
		if ($ut(i)) {
			let l = o ? i[QW.PATH] : s[0],
				c = o ? i[QW.PATTERN] : i[l]
			if (!Ru(c)) throw new Error(wut(l))
			let u = { keyId: _W(l), pattern: c }
			return r && (u.searcher = FW(c, t)), u
		}
		let a = { children: [], operator: s[0] }
		return (
			s.forEach((l) => {
				let c = i[l]
				Jd(c) &&
					c.forEach((u) => {
						a.children.push(n(u))
					})
			}),
			a
		)
	}
	return NW(e) || (e = Mme(e)), n(e)
}