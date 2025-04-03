
var Kie = x((ZIt, Yie) => {
	"use strict"
	var b$e = WB()
	Yie.exports = (e) => {
		let t = e?.maxRedirections
		return (r) =>
			function (i, s) {
				let { maxRedirections: o = t, ...a } = i
				if (!o) return r(i, s)
				let l = new b$e(r, o, i, s)
				return r(a, l)
			}
	}
})