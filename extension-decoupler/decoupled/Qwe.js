
	function qWe(e, t) {
		if (wB === void 0) return !0
		let r = xte(t)
		if (r === "no metadata" || r.length === 0) return !0
		let n = HWe(r),
			i = WWe(r, n)
		for (let s of i) {
			let o = s.algo,
				a = s.hash,
				l = wB.createHash(o).update(e).digest("base64")
			if (
				(l[l.length - 1] === "=" && (l[l.length - 2] === "=" ? (l = l.slice(0, -2)) : (l = l.slice(0, -1))),
				GWe(l, a))
			)
				return !0
		}
		return !1
	}