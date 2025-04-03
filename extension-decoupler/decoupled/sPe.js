
var Spe = x((FTt, Ipe) => {
	"use strict"
	var MH = kH(),
		elt = wpe(),
		hy = {},
		tlt = Object.keys(MH)
	function rlt(e) {
		var t = function (r) {
			return r == null ? r : (arguments.length > 1 && (r = Array.prototype.slice.call(arguments)), e(r))
		}
		return "conversion" in e && (t.conversion = e.conversion), t
	}
	function nlt(e) {
		var t = function (r) {
			if (r == null) return r
			arguments.length > 1 && (r = Array.prototype.slice.call(arguments))
			var n = e(r)
			if (typeof n == "object") for (var i = n.length, s = 0; s < i; s++) n[s] = Math.round(n[s])
			return n
		}
		return "conversion" in e && (t.conversion = e.conversion), t
	}
	tlt.forEach(function (e) {
		;(hy[e] = {}),
			Object.defineProperty(hy[e], "channels", { value: MH[e].channels }),
			Object.defineProperty(hy[e], "labels", { value: MH[e].labels })
		var t = elt(e),
			r = Object.keys(t)
		r.forEach(function (n) {
			var i = t[n]
			;(hy[e][n] = nlt(i)), (hy[e][n].raw = rlt(i))
		})
	})
	Ipe.exports = hy
})