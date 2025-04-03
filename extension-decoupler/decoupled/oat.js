
var bG,
	FEe,
	OAt = Se({
		"src/lib/tasks/version.ts"() {
			"use strict"
			wt(),
				(bG = "installed=false"),
				(FEe = [
					new Ft(/version (\d+)\.(\d+)\.(\d+)(?:\s*\((.+)\))?/, (e, [t, r, n, i = ""]) => {
						Object.assign(e, PM(mn(t), mn(r), mn(n), i))
					}),
					new Ft(/version (\d+)\.(\d+)\.(\D+)(.+)?$/, (e, [t, r, n, i = ""]) => {
						Object.assign(e, PM(mn(t), mn(r), n, i))
					}),
				])
		},
	}),
	QEe = {}