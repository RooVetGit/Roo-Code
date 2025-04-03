
var Bye = x((iQt, Sye) => {
	"use strict"
	var r4 = Ws(),
		rht = bl(),
		Iye = Lx(),
		nht = (e, t) => {
			e = new rht(e, t)
			let r = new r4("0.0.0")
			if (e.test(r) || ((r = new r4("0.0.0-0")), e.test(r))) return r
			r = null
			for (let n = 0; n < e.set.length; ++n) {
				let i = e.set[n],
					s = null
				i.forEach((o) => {
					let a = new r4(o.semver.version)
					switch (o.operator) {
						case ">":
							a.prerelease.length === 0 ? a.patch++ : a.prerelease.push(0), (a.raw = a.format())
						case "":
						case ">=":
							;(!s || Iye(a, s)) && (s = a)
							break
						case "<":
						case "<=":
							break
						default:
							throw new Error(`Unexpected operation: ${o.operator}`)
					}
				}),
					s && (!r || Iye(r, s)) && (r = s)
			}
			return r && e.test(r) ? r : null
		}
	Sye.exports = nht
})