
var P7 = x((R_t, N7) => {
	"use strict"
	var zUe = yU(),
		jUe = F7(),
		ZUe = gd(),
		XUe = vU(),
		eOe = /[\\^$.*+?()[\]{}|]/g,
		tOe = /^\[object .+?Constructor\]$/,
		rOe = Function.prototype,
		nOe = Object.prototype,
		iOe = rOe.toString,
		sOe = nOe.hasOwnProperty,
		oOe = RegExp(
			"^" +
				iOe
					.call(sOe)
					.replace(eOe, "\\$&")
					.replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") +
				"$",
		)
	function aOe(e) {
		if (!ZUe(e) || jUe(e)) return !1
		var t = zUe(e) ? oOe : tOe
		return t.test(XUe(e))
	}
	N7.exports = aOe
})