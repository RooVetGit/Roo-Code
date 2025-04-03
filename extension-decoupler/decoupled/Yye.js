
	var Wye = bl(),
		i4 = Ux(),
		{ ANY: n4 } = i4,
		Vx = qx(),
		s4 = El(),
		vht = (e, t, r = {}) => {
			if (e === t) return !0
			;(e = new Wye(e, r)), (t = new Wye(t, r))
			let n = !1
			e: for (let i of e.set) {
				for (let s of t.set) {
					let o = bht(i, s, r)
					if (((n = n || o !== null), o)) continue e
				}
				if (n) return !1
			}
			return !0
		},
		Eht = [new i4(">=0.0.0-0")],
		Gye = [new i4(">=0.0.0")],
		bht = (e, t, r) => {
			if (e === t) return !0
			if (e.length === 1 && e[0].semver === n4) {
				if (t.length === 1 && t[0].semver === n4) return !0
				r.includePrerelease ? (e = Eht) : (e = Gye)
			}
			if (t.length === 1 && t[0].semver === n4) {
				if (r.includePrerelease) return !0
				t = Gye
			}
			let n = new Set(),
				i,
				s
			for (let g of e)
				g.operator === ">" || g.operator === ">="
					? (i = $ye(i, g, r))
					: g.operator === "<" || g.operator === "<="
						? (s = Yye(s, g, r))
						: n.add(g.semver)
			if (n.size > 1) return null
			let o
			if (i && s) {
				if (((o = s4(i.semver, s.semver, r)), o > 0)) return null
				if (o === 0 && (i.operator !== ">=" || s.operator !== "<=")) return null
			}
			for (let g of n) {
				if ((i && !Vx(g, String(i), r)) || (s && !Vx(g, String(s), r))) return null
				for (let m of t) if (!Vx(g, String(m), r)) return !1
				return !0
			}
			let a,
				l,
				c,
				u,
				f = s && !r.includePrerelease && s.semver.prerelease.length ? s.semver : !1,
				p = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1
			f && f.prerelease.length === 1 && s.operator === "<" && f.prerelease[0] === 0 && (f = !1)
			for (let g of t) {
				if (
					((u = u || g.operator === ">" || g.operator === ">="),
					(c = c || g.operator === "<" || g.operator === "<="),
					i)
				) {
					if (
						(p &&
							g.semver.prerelease &&
							g.semver.prerelease.length &&
							g.semver.major === p.major &&
							g.semver.minor === p.minor &&
							g.semver.patch === p.patch &&
							(p = !1),
						g.operator === ">" || g.operator === ">=")
					) {
						if (((a = $ye(i, g, r)), a === g && a !== i)) return !1
					} else if (i.operator === ">=" && !Vx(i.semver, String(g), r)) return !1
				}
				if (s) {
					if (
						(f &&
							g.semver.prerelease &&
							g.semver.prerelease.length &&
							g.semver.major === f.major &&
							g.semver.minor === f.minor &&
							g.semver.patch === f.patch &&
							(f = !1),
						g.operator === "<" || g.operator === "<=")
					) {
						if (((l = Yye(s, g, r)), l === g && l !== s)) return !1
					} else if (s.operator === "<=" && !Vx(s.semver, String(g), r)) return !1
				}
				if (!g.operator && (s || i) && o !== 0) return !1
			}
			return !((i && c && !s && o !== 0) || (s && u && !i && o !== 0) || p || f)
		},
		$ye = (e, t, r) => {
			if (!e) return t
			let n = s4(e.semver, t.semver, r)
			return n > 0 ? e : n < 0 || (t.operator === ">" && e.operator === ">=") ? t : e
		},
		Yye = (e, t, r) => {
			if (!e) return t
			let n = s4(e.semver, t.semver, r)
			return n < 0 ? e : n > 0 || (t.operator === "<" && e.operator === "<=") ? t : e
		}