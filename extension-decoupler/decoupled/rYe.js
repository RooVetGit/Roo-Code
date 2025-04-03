
	var oht = Ws(),
		Mye = Ux(),
		{ ANY: aht } = Mye,
		lht = bl(),
		cht = qx(),
		Rye = Lx(),
		kye = Lk(),
		uht = Ok(),
		dht = Uk(),
		fht = (e, t, r, n) => {
			;(e = new oht(e, n)), (t = new lht(t, n))
			let i, s, o, a, l
			switch (r) {
				case ">":
					;(i = Rye), (s = uht), (o = kye), (a = ">"), (l = ">=")
					break
				case "<":
					;(i = kye), (s = dht), (o = Rye), (a = "<"), (l = "<=")
					break
				default:
					throw new TypeError('Must provide a hilo val of "<" or ">"')
			}
			if (cht(e, t, n)) return !1
			for (let c = 0; c < t.set.length; ++c) {
				let u = t.set[c],
					f = null,
					p = null
				if (
					(u.forEach((g) => {
						g.semver === aht && (g = new Mye(">=0.0.0")),
							(f = f || g),
							(p = p || g),
							i(g.semver, f.semver, n) ? (f = g) : o(g.semver, p.semver, n) && (p = g)
					}),
					f.operator === a || f.operator === l || ((!p.operator || p.operator === a) && s(e, p.semver)))
				)
					return !1
				if (p.operator === l && o(e, p.semver)) return !1
			}
			return !0
		}