
var GB = x((AIt, yre) => {
	"use strict"
	var ZGe = WB()
	function XGe({ maxRedirections: e }) {
		return (t) =>
			function (n, i) {
				let { maxRedirections: s = e } = n
				if (!s) return t(n, i)
				let o = new ZGe(t, s, n, i)
				return (n = { ...n, maxRedirections: 0 }), t(n, o)
			}
	}
	yre.exports = XGe
})