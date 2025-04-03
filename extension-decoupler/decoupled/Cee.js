
var CEe,
	xAt = Se({
		"src/lib/parsers/parse-remote-objects.ts"() {
			"use strict"
			wt(),
				(CEe = [
					new Vh(/^remote:\s*(enumerating|counting|compressing) objects: (\d+),/i, (e, [t, r]) => {
						let n = t.toLowerCase(),
							i = L4(e.remoteMessages)
						Object.assign(i, { [n]: mn(r) })
					}),
					new Vh(
						/^remote:\s*(enumerating|counting|compressing) objects: \d+% \(\d+\/(\d+)\),/i,
						(e, [t, r]) => {
							let n = t.toLowerCase(),
								i = L4(e.remoteMessages)
							Object.assign(i, { [n]: mn(r) })
						},
					),
					new Vh(/total ([^,]+), reused ([^,]+), pack-reused (\d+)/i, (e, [t, r, n]) => {
						let i = L4(e.remoteMessages)
						;(i.total = UCe(t)), (i.reused = UCe(r)), (i.packReused = mn(n))
					}),
				])
		},
	})