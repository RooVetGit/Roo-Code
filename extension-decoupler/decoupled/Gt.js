
var GT = x((MDt, WT) => {
	"use strict"
	var w3 = C3(),
		{ LEVEL: x3, MESSAGE: _3 } = Bi()
	w3.enabled = !0
	var vfe = /\s+/,
		HT = class e {
			constructor(t = {}) {
				t.colors && this.addColors(t.colors), (this.options = t)
			}
			static addColors(t) {
				let r = Object.keys(t).reduce((n, i) => ((n[i] = vfe.test(t[i]) ? t[i].split(vfe) : t[i]), n), {})
				return (e.allColors = Object.assign({}, e.allColors || {}, r)), e.allColors
			}
			addColors(t) {
				return e.addColors(t)
			}
			colorize(t, r, n) {
				if ((typeof n > "u" && (n = r), !Array.isArray(e.allColors[t]))) return w3[e.allColors[t]](n)
				for (let i = 0, s = e.allColors[t].length; i < s; i++) n = w3[e.allColors[t][i]](n)
				return n
			}
			transform(t, r) {
				return (
					r.all && typeof t[_3] == "string" && (t[_3] = this.colorize(t[x3], t.level, t[_3])),
					(r.level || r.all || !r.message) && (t.level = this.colorize(t[x3], t.level)),
					(r.all || r.message) && (t.message = this.colorize(t[x3], t.level, t.message)),
					t
				)
			}
		}
	WT.exports = (e) => new HT(e)
	WT.exports.Colorizer = WT.exports.Format = HT
})