
var Vpe = x((OTt, qpe) => {
	"use strict"
	qpe.exports = function (t, r) {
		if (!r) return !1
		for (var n = r.split(/[\s,]+/), i = 0; i < n.length; i++) {
			if (((r = n[i].replace("*", ".*?")), r.charAt(0) === "-")) {
				if (new RegExp("^" + r.substr(1) + "$").test(t)) return !1
				continue
			}
			if (new RegExp("^" + r + "$").test(t)) return !0
		}
		return !1
	}
})