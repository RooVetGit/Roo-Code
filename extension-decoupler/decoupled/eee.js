
var EEe,
	bEe,
	xEe = Se({
		"src/lib/parsers/parse-remote-messages.ts"() {
			"use strict"
			wt(),
				xAt(),
				(EEe = [
					new Vh(/^remote:\s*(.+)$/, (e, [t]) => (e.remoteMessages.all.push(t.trim()), !1)),
					...CEe,
					new Vh([/create a (?:pull|merge) request/i, /\s(https?:\/\/\S+)$/], (e, [t]) => {
						e.remoteMessages.pullRequestUrl = t
					}),
					new Vh([/found (\d+) vulnerabilities.+\(([^)]+)\)/i, /\s(https?:\/\/\S+)$/], (e, [t, r, n]) => {
						e.remoteMessages.vulnerabilities = {
							count: mn(t),
							summary: r,
							url: n,
						}
					}),
				]),
				(bEe = class {
					constructor() {
						this.all = []
					}
				})
		},
	})