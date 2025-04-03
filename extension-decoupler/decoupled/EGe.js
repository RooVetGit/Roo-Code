
var Ege = x((CR, vge) => {
	"use strict"
	Object.defineProperty(CR, "__esModule", { value: !0 })
	CR.default = Iot
	var Eot = hge(),
		bot = Cge(Eot),
		xot = Age(),
		_ot = Cge(xot),
		wot = Vp()
	function Cge(e) {
		return e && e.__esModule ? e : { default: e }
	}
	function Iot(e) {
		return (0, wot.isAsync)(e)
			? function (...t) {
					let r = t.pop(),
						n = e.apply(this, t)
					return mge(n, r)
				}
			: (0, bot.default)(function (t, r) {
					var n
					try {
						n = e.apply(this, t)
					} catch (i) {
						return r(i)
					}
					if (n && typeof n.then == "function") return mge(n, r)
					r(null, n)
				})
	}
	function mge(e, t) {
		return e.then(
			(r) => {
				yge(t, null, r)
			},
			(r) => {
				yge(t, r && (r instanceof Error || r.message) ? r : new Error(r))
			},
		)
	}
	function yge(e, t, r) {
		try {
			e(t, r)
		} catch (n) {
			;(0, _ot.default)((i) => {
				throw i
			}, n)
		}
	}
	vge.exports = CR.default
})