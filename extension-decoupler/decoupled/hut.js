
var Hut = new Set([_k.type, wk.type]),
	kW = class {
		constructor(
			t,
			{
				isCaseSensitive: r = Dt.isCaseSensitive,
				includeMatches: n = Dt.includeMatches,
				minMatchCharLength: i = Dt.minMatchCharLength,
				ignoreLocation: s = Dt.ignoreLocation,
				findAllMatches: o = Dt.findAllMatches,
				location: a = Dt.location,
				threshold: l = Dt.threshold,
				distance: c = Dt.distance,
			} = {},
		) {
			;(this.query = null),
				(this.options = {
					isCaseSensitive: r,
					includeMatches: n,
					minMatchCharLength: i,
					findAllMatches: o,
					ignoreLocation: s,
					location: a,
					threshold: l,
					distance: c,
				}),
				(this.pattern = r ? t : t.toLowerCase()),
				(this.query = Vut(this.pattern, this.options))
		}
		static condition(t, r) {
			return r.useExtendedSearch
		}
		searchIn(t) {
			let r = this.query
			if (!r) return { isMatch: !1, score: 1 }
			let { includeMatches: n, isCaseSensitive: i } = this.options
			t = i ? t : t.toLowerCase()
			let s = 0,
				o = [],
				a = 0
			for (let l = 0, c = r.length; l < c; l += 1) {
				let u = r[l]
				;(o.length = 0), (s = 0)
				for (let f = 0, p = u.length; f < p; f += 1) {
					let g = u[f],
						{ isMatch: m, indices: y, score: C } = g.search(t)
					if (m) {
						if (((s += 1), (a += C), n)) {
							let v = g.constructor.type
							Hut.has(v) ? (o = [...o, ...y]) : o.push(y)
						}
					} else {
						;(a = 0), (s = 0), (o.length = 0)
						break
					}
				}
				if (s) {
					let f = { isMatch: !0, score: a / s }
					return n && (f.indices = o), f
				}
			}
			return { isMatch: !1, score: 1 }
		}
	},
	MW = []