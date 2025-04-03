
var go = class {
	constructor(t, r = {}, n) {
		;(this.options = { ...Dt, ...r }),
			this.options.useExtendedSearch,
			(this._keyStore = new xW(this.options.keys)),
			this.setCollection(t, n)
	}
	setCollection(t, r) {
		if (((this._docs = t), r && !(r instanceof Tx))) throw new Error(_ut)
		this._myIndex =
			r ||
			Lme(this.options.keys, this._docs, {
				getFn: this.options.getFn,
				fieldNormWeight: this.options.fieldNormWeight,
			})
	}
	add(t) {
		Sa(t) && (this._docs.push(t), this._myIndex.add(t))
	}
	remove(t = () => !1) {
		let r = []
		for (let n = 0, i = this._docs.length; n < i; n += 1) {
			let s = this._docs[n]
			t(s, n) && (this.removeAt(n), (n -= 1), (i -= 1), r.push(s))
		}
		return r
	}
	removeAt(t) {
		this._docs.splice(t, 1), this._myIndex.removeAt(t)
	}
	getIndex() {
		return this._myIndex
	}
	search(t, { limit: r = -1 } = {}) {
		let { includeMatches: n, includeScore: i, shouldSort: s, sortFn: o, ignoreFieldNorm: a } = this.options,
			l = Ru(t)
				? Ru(this._docs[0])
					? this._searchStringList(t)
					: this._searchObjectList(t)
				: this._searchLogical(t)
		return (
			Yut(l, { ignoreFieldNorm: a }),
			s && l.sort(o),
			Fme(r) && r > -1 && (l = l.slice(0, r)),
			zut(l, this._docs, { includeMatches: n, includeScore: i })
		)
	}
	_searchStringList(t) {
		let r = FW(t, this.options),
			{ records: n } = this._myIndex,
			i = []
		return (
			n.forEach(({ v: s, i: o, n: a }) => {
				if (!Sa(s)) return
				let { isMatch: l, score: c, indices: u } = r.searchIn(s)
				l &&
					i.push({
						item: s,
						idx: o,
						matches: [{ score: c, value: s, norm: a, indices: u }],
					})
			}),
			i
		)
	}
	_searchLogical(t) {
		let r = Ume(t, this.options),
			n = (a, l, c) => {
				if (!a.children) {
					let { keyId: f, searcher: p } = a,
						g = this._findMatches({
							key: this._keyStore.get(f),
							value: this._myIndex.getValueForItemAtKeyId(l, f),
							searcher: p,
						})
					return g && g.length ? [{ idx: c, item: l, matches: g }] : []
				}
				let u = []
				for (let f = 0, p = a.children.length; f < p; f += 1) {
					let g = a.children[f],
						m = n(g, l, c)
					if (m.length) u.push(...m)
					else if (a.operator === Ik.AND) return []
				}
				return u
			},
			i = this._myIndex.records,
			s = {},
			o = []
		return (
			i.forEach(({ $: a, i: l }) => {
				if (Sa(a)) {
					let c = n(r, a, l)
					c.length &&
						(s[l] || ((s[l] = { idx: l, item: a, matches: [] }), o.push(s[l])),
						c.forEach(({ matches: u }) => {
							s[l].matches.push(...u)
						}))
				}
			}),
			o
		)
	}
	_searchObjectList(t) {
		let r = FW(t, this.options),
			{ keys: n, records: i } = this._myIndex,
			s = []
		return (
			i.forEach(({ $: o, i: a }) => {
				if (!Sa(o)) return
				let l = []
				n.forEach((c, u) => {
					l.push(...this._findMatches({ key: c, value: o[u], searcher: r }))
				}),
					l.length && s.push({ idx: a, item: o, matches: l })
			}),
			s
		)
	}
	_findMatches({ key: t, value: r, searcher: n }) {
		if (!Sa(r)) return []
		let i = []
		if (Jd(r))
			r.forEach(({ v: s, i: o, n: a }) => {
				if (!Sa(s)) return
				let { isMatch: l, score: c, indices: u } = n.searchIn(s)
				l && i.push({ score: c, key: t, value: s, idx: o, norm: a, indices: u })
			})
		else {
			let { v: s, n: o } = r,
				{ isMatch: a, score: l, indices: c } = n.searchIn(s)
			a && i.push({ score: l, key: t, value: s, norm: o, indices: c })
		}
		return i
	}
}