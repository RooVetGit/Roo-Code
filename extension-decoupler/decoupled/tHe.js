
var the = x((KDt, ehe) => {
	"use strict"
	var git = require("util"),
		{ SPLAT: Xfe } = Bi(),
		pit = /%[scdjifoO%]/g,
		Ait = /%%/g,
		N3 = class {
			constructor(t) {
				this.options = t
			}
			_splat(t, r) {
				let n = t.message,
					i = t[Xfe] || t.splat || [],
					s = n.match(Ait),
					o = (s && s.length) || 0,
					l = r.length - o - i.length,
					c = l < 0 ? i.splice(l, -1 * l) : [],
					u = c.length
				if (u) for (let f = 0; f < u; f++) Object.assign(t, c[f])
				return (t.message = git.format(n, ...i)), t
			}
			transform(t) {
				let r = t.message,
					n = t[Xfe] || t.splat
				if (!n || !n.length) return t
				let i = r && r.match && r.match(pit)
				if (!i && (n || n.length)) {
					let s = n.length > 1 ? n.splice(0) : n,
						o = s.length
					if (o) for (let a = 0; a < o; a++) Object.assign(t, s[a])
					return t
				}
				return i ? this._splat(t, i) : t
			}
		}
	ehe.exports = (e) => new N3(e)
})