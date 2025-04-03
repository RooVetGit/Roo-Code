
var OEe,
	YAt = Se({
		"src/lib/responses/BranchDeleteSummary.ts"() {
			"use strict"
			OEe = class {
				constructor() {
					;(this.all = []), (this.branches = {}), (this.errors = [])
				}
				get success() {
					return !this.errors.length
				}
			}
		},
	})