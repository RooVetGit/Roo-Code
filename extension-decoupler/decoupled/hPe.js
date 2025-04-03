
var hpe = x((DTt, fpe) => {
	"use strict"
	var $at = upe(),
		Yat = Array.prototype.concat,
		Kat = Array.prototype.slice,
		dpe = (fpe.exports = function (t) {
			for (var r = [], n = 0, i = t.length; n < i; n++) {
				var s = t[n]
				$at(s) ? (r = Yat.call(r, Kat.call(s))) : r.push(s)
			}
			return r
		})
	dpe.wrap = function (e) {
		return function () {
			return e(dpe(arguments))
		}
	}
})