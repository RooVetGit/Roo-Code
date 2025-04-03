
var nve,
	abe,
	Nmt = Se({
		"src/lib/responses/TagList.ts"() {
			"use strict"
			;(nve = class {
				constructor(e, t) {
					;(this.all = e), (this.latest = t)
				}
			}),
				(abe = function (e, t = !1) {
					let r = e
						.split(
							`
`,
						)
						.map(Qmt)
						.filter(Boolean)
					t ||
						r.sort(function (i, s) {
							let o = i.split("."),
								a = s.split(".")
							if (o.length === 1 || a.length === 1) return Fmt(DM(o[0]), DM(a[0]))
							for (let l = 0, c = Math.max(o.length, a.length); l < c; l++) {
								let u = obe(DM(o[l]), DM(a[l]))
								if (u) return u
							}
							return 0
						})
					let n = t ? r[0] : [...r].reverse().find((i) => i.indexOf(".") >= 0)
					return new nve(r, n)
				})
		},
	}),
	lbe = {}