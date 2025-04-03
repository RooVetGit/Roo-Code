
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