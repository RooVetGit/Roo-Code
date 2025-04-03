
var nwe = x((QKt, rwe) => {
	"use strict"
	function K_e(e) {
		return Array.isArray(e) ? e : [e]
	}
	var Z_e = "",
		J_e = " ",
		x8 = "\\",
		Byt = /^\s+$/,
		Dyt = /(?:[^\\]|^)\\$/,
		Tyt = /^\\!/,
		Ryt = /^\\#/,
		kyt = /\r?\n/g,
		Myt = /^\.*\/|^\.+$/,
		_8 = "/",
		X_e = "node-ignore"
	typeof Symbol < "u" && (X_e = Symbol.for("node-ignore"))
	var z_e = X_e,
		Fyt = (e, t, r) => Object.defineProperty(e, t, { value: r }),
		Qyt = /([0-z])-([0-z])/g,
		ewe = () => !1,
		Nyt = (e) => e.replace(Qyt, (t, r, n) => (r.charCodeAt(0) <= n.charCodeAt(0) ? t : Z_e)),
		Pyt = (e) => {
			let { length: t } = e
			return e.slice(0, t - (t % 2))
		},
		Lyt = [
			[/\\?\s+$/, (e) => (e.indexOf("\\") === 0 ? J_e : Z_e)],
			[/\\\s/g, () => J_e],
			[/[\\$.|*+(){^]/g, (e) => `\\${e}`],
			[/(?!\\)\?/g, () => "[^/]"],
			[/^\//, () => "^"],
			[/\//g, () => "\\/"],
			[/^\^*\\\*\\\*\\\//, () => "^(?:.*\\/)?"],
			[
				/^(?=[^^])/,
				function () {
					return /\/(?!$)/.test(this) ? "^" : "(?:^|\\/)"
				},
			],
			[/\\\/\\\*\\\*(?=\\\/|$)/g, (e, t, r) => (t + 6 < r.length ? "(?:\\/[^\\/]+)*" : "\\/.+")],
			[
				/(^|[^\\]+)(\\\*)+(?=.+)/g,
				(e, t, r) => {
					let n = r.replace(/\\\*/g, "[^\\/]*")
					return t + n
				},
			],
			[/\\\\\\(?=[$.|*+(){^])/g, () => x8],
			[/\\\\/g, () => x8],
			[
				/(\\)?\[([^\]/]*?)(\\*)($|\])/g,
				(e, t, r, n, i) =>
					t === x8 ? `\\[${r}${Pyt(n)}${i}` : i === "]" && n.length % 2 === 0 ? `[${Nyt(r)}${n}]` : "[]",
			],
			[/(?:[^*])$/, (e) => (/\/$/.test(e) ? `${e}$` : `${e}(?=$|\\/$)`)],
			[/(\^|\\\/)?\\\*$/, (e, t) => `${t ? `${t}[^/]+` : "[^/]*"}(?=$|\\/$)`],
		],
		j_e = Object.create(null),
		Uyt = (e, t) => {
			let r = j_e[e]
			return (
				r || ((r = Lyt.reduce((n, i) => n.replace(i[0], i[1].bind(e)), e)), (j_e[e] = r)),
				t ? new RegExp(r, "i") : new RegExp(r)
			)
		},
		S8 = (e) => typeof e == "string",
		Oyt = (e) => e && S8(e) && !Byt.test(e) && !Dyt.test(e) && e.indexOf("#") !== 0,
		qyt = (e) => e.split(kyt),
		w8 = class {
			constructor(t, r, n, i) {
				;(this.origin = t), (this.pattern = r), (this.negative = n), (this.regex = i)
			}
		},
		Vyt = (e, t) => {
			let r = e,
				n = !1
			e.indexOf("!") === 0 && ((n = !0), (e = e.substr(1))), (e = e.replace(Tyt, "!").replace(Ryt, "#"))
			let i = Uyt(e, t)
			return new w8(r, e, n, i)
		},
		Hyt = (e, t) => {
			throw new t(e)
		},
		gf = (e, t, r) =>
			S8(e)
				? e
					? gf.isNotRelative(e)
						? r(`path should be a \`path.relative()\`d string, but got "${t}"`, RangeError)
						: !0
					: r("path must not be empty", TypeError)
				: r(`path must be a string, but got \`${t}\``, TypeError),
		twe = (e) => Myt.test(e)
	gf.isNotRelative = twe
	gf.convert = (e) => e
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
	$Q.isPathValid = Wyt
	$Q.default = $Q
	rwe.exports = $Q
	if (typeof process < "u" && ((process.env && process.env.IGNORE_TEST_WIN32) || process.platform === "win32")) {
		let e = (r) => (/^\\\\\?\\/.test(r) || /["<>|\u0000-\u001F]+/u.test(r) ? r : r.replace(/\\/g, "/"))
		gf.convert = e
		let t = /^[a-z]:\//i
		gf.isNotRelative = (r) => t.test(r) || twe(r)
	}
})