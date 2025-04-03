
var Uge = x((DR, Lge) => {
	"use strict"
	Object.defineProperty(DR, "__esModule", { value: !0 })
	var tat = CH(),
		rat = tx(tat),
		nat = Rge(),
		iat = tx(nat),
		sat = vH(),
		oat = tx(sat),
		Nge = Vp(),
		aat = Qge(),
		Pge = tx(aat),
		lat = SR(),
		cat = tx(lat)
	function tx(e) {
		return e && e.__esModule ? e : { default: e }
	}
	DR.default = (e) => (t, r, n) => {
		if (((n = (0, rat.default)(n)), e <= 0)) throw new RangeError("concurrency limit cannot be less than 1")
		if (!t) return n(null)
		if ((0, Nge.isAsyncGenerator)(t)) return (0, Pge.default)(t, e, r, n)
		if ((0, Nge.isAsyncIterable)(t)) return (0, Pge.default)(t[Symbol.asyncIterator](), e, r, n)
		var i = (0, iat.default)(t),
			s = !1,
			o = !1,
			a = 0,
			l = !1
		function c(f, p) {
			if (!o)
				if (((a -= 1), f)) (s = !0), n(f)
				else if (f === !1) (s = !0), (o = !0)
				else {
					if (p === cat.default || (s && a <= 0)) return (s = !0), n(null)
					l || u()
				}
		}
		function u() {
			for (l = !0; a < e && !s; ) {
				var f = i()
				if (f === null) {
					;(s = !0), a <= 0 && n(null)
					return
				}
				;(a += 1), r(f.value, f.key, (0, oat.default)(c))
			}
			l = !1
		}
		u()
	}
	Lge.exports = DR.default
})