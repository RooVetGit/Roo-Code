
var WEe,
	zAt = Se({
		"src/lib/parsers/parse-branch.ts"() {
			"use strict"
			JAt(),
				wt(),
				(WEe = [
					new Ft(
						/^([*+]\s)?\((?:HEAD )?detached (?:from|at) (\S+)\)\s+([a-z0-9]+)\s(.*)$/,
						(e, [t, r, n, i]) => {
							e.push(rve(t), !0, r, n, i)
						},
					),
					new Ft(new RegExp("^([*+]\\s)?(\\S+)\\s+([a-z0-9]+)\\s?(.*)$", "s"), (e, [t, r, n, i]) => {
						e.push(rve(t), !1, r, n, i)
					}),
				])
		},
	}),
	GEe = {}