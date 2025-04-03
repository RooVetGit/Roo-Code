
var nEe,
	Zpt = Se({
		"src/lib/tasks/count-objects.ts"() {
			"use strict"
			wt(),
				(nEe = new Ft(/([a-z-]+): (\d+)$/, (e, [t, r]) => {
					let n = mve(t)
					e.hasOwnProperty(n) && (e[n] = mn(r))
				}))
		},
	})