
var q3 = x((tR) => {
	"use strict"
	var { format: lhe } = require("util")
	tR.warn = {
		deprecated(e) {
			return () => {
				throw new Error(lhe("{ %s } was removed in winston@3.0.0.", e))
			}
		},
		useFormat(e) {
			return () => {
				throw new Error(
					[
						lhe("{ %s } was removed in winston@3.0.0.", e),
						"Use a custom winston.format = winston.format(function) instead.",
					].join(`
`),
				)
			}
		},
		forFunctions(e, t, r) {
			r.forEach((n) => {
				e[n] = tR.warn[t](n)
			})
		},
		forProperties(e, t, r) {
			r.forEach((n) => {
				let i = tR.warn[t](n)
				Object.defineProperty(e, n, { get: i, set: i })
			})
		},
	}
})