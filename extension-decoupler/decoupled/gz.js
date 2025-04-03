
var GZ = x((dwt, WZ) => {
	"use strict"
	function Xqe(e, t) {
		for (var r = -1, n = e == null ? 0 : e.length, i = 0, s = []; ++r < n; ) {
			var o = e[r]
			t(o, r, e) && (s[i++] = o)
		}
		return s
	}
	WZ.exports = Xqe
})