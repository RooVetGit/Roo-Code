
var Pie = x((YIt, Nie) => {
	"use strict"
	var { Transform: o$e } = require("stream"),
		{ Console: a$e } = require("console"),
		l$e = process.versions.icu ? "\u2705" : "Y ",
		c$e = process.versions.icu ? "\u274C" : "N "
	Nie.exports = class {
		constructor({ disableColors: t } = {}) {
			;(this.transform = new o$e({
				transform(r, n, i) {
					i(null, r)
				},
			})),
				(this.logger = new a$e({
					stdout: this.transform,
					inspectOptions: { colors: !t && !process.env.CI },
				}))
		}
		format(t) {
			let r = t.map(
				({
					method: n,
					path: i,
					data: { statusCode: s },
					persist: o,
					times: a,
					timesInvoked: l,
					origin: c,
				}) => ({
					Method: n,
					Origin: c,
					Path: i,
					"Status code": s,
					Persistent: o ? l$e : c$e,
					Invocations: l,
					Remaining: o ? 1 / 0 : a - l,
				}),
			)
			return this.logger.table(r), this.transform.read().toString()
		}
	}
})