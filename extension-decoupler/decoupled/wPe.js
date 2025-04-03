
var Wpe = x((qTt, Hpe) => {
	"use strict"
	var clt = Vpe()
	Hpe.exports = function (t) {
		return function (n) {
			try {
				return clt(n, t())
			} catch {}
			return !1
		}
	}
})