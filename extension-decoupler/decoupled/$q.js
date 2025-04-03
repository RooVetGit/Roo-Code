
	var I8 = class {
			constructor({ ignorecase: t = !0, ignoreCase: r = t, allowRelativePaths: n = !1 } = {}) {
				Fyt(this, z_e, !0),
					(this._rules = []),
					(this._ignoreCase = r),
					(this._allowRelativePaths = n),
					this._initCache()
			}
			_initCache() {
				;(this._ignoreCache = Object.create(null)), (this._testCache = Object.create(null))
			}
			_addPattern(t) {
				if (t && t[z_e]) {
					;(this._rules = this._rules.concat(t._rules)), (this._added = !0)
					return
				}
				if (Oyt(t)) {
					let r = Vyt(t, this._ignoreCase)
					;(this._added = !0), this._rules.push(r)
				}
			}
			add(t) {
				return (
					(this._added = !1),
					K_e(S8(t) ? qyt(t) : t).forEach(this._addPattern, this),
					this._added && this._initCache(),
					this
				)
			}
			addPattern(t) {
				return this.add(t)
			}
			_testOne(t, r) {
				let n = !1,
					i = !1
				return (
					this._rules.forEach((s) => {
						let { negative: o } = s
						if ((i === o && n !== i) || (o && !n && !i && !r)) return
						s.regex.test(t) && ((n = !o), (i = o))
					}),
					{ ignored: n, unignored: i }
				)
			}
			_test(t, r, n, i) {
				let s = t && gf.convert(t)
				return gf(s, t, this._allowRelativePaths ? ewe : Hyt), this._t(s, r, n, i)
			}
			_t(t, r, n, i) {
				if (t in r) return r[t]
				if ((i || (i = t.split(_8)), i.pop(), !i.length)) return (r[t] = this._testOne(t, n))
				let s = this._t(i.join(_8) + _8, r, n, i)
				if (s.ignored) return (r[t] = s)
				let o = this._testOne(t, n)
				return (r[t] = {
					ignored: o.ignored,
					unignored: s.unignored || o.unignored,
				})
			}
			ignores(t) {
				return this._test(t, this._ignoreCache, !1).ignored
			}
			createFilter() {
				return (t) => !this.ignores(t)
			}
			filter(t) {
				return K_e(t).filter(this.createFilter())
			}
			test(t) {
				return this._test(t, this._testCache, !0)
			}
		},
		$Q = (e) => new I8(e),
		Wyt = (e) => gf(e && gf.convert(e), e, ewe)