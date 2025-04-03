
var Kde = x((mDt, Yde) => {
	"use strict"
	Yde.exports = function (e, t) {
		t = t || process.argv || []
		var r = t.indexOf("--"),
			n = /^-{1,2}/.test(e) ? "" : "--",
			i = t.indexOf(n + e)
		return i !== -1 && (r === -1 ? !0 : i < r)
	}
})