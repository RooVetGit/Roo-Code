
var pG,
	i_ = Se({
		"src/lib/args/log-format.ts"() {
			"use strict"
			pG = /^--(stat|numstat|name-only|name-status)(=|$)/
		},
	}),
	aEe,
	gAt = Se({
		"src/lib/responses/DiffSummary.ts"() {
			"use strict"
			aEe = class {
				constructor() {
					;(this.changed = 0), (this.deletions = 0), (this.insertions = 0), (this.files = [])
				}
			}
		},
	})