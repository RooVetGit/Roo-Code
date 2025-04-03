
var J4,
	AEe = Se({
		"src/lib/tasks/log.ts"() {
			"use strict"
			i_(),
				Xx(),
				hEe(),
				wt(),
				Ci(),
				CG(),
				(J4 = ((e) => (
					(e[(e["--pretty"] = 0)] = "--pretty"),
					(e[(e["max-count"] = 1)] = "max-count"),
					(e[(e.maxCount = 2)] = "maxCount"),
					(e[(e.n = 3)] = "n"),
					(e[(e.file = 4)] = "file"),
					(e[(e.format = 5)] = "format"),
					(e[(e.from = 6)] = "from"),
					(e[(e.to = 7)] = "to"),
					(e[(e.splitter = 8)] = "splitter"),
					(e[(e.symmetric = 9)] = "symmetric"),
					(e[(e.mailMap = 10)] = "mailMap"),
					(e[(e.multiLine = 11)] = "multiLine"),
					(e[(e.strictDate = 12)] = "strictDate"),
					e
				))(J4 || {}))
		},
	}),
	MM,
	mEe,
	EAt = Se({
		"src/lib/responses/MergeSummary.ts"() {
			"use strict"
			;(MM = class {
				constructor(e, t = null, r) {
					;(this.reason = e), (this.file = t), (this.meta = r)
				}
				toString() {
					return `${this.file}:${this.reason}`
				}
			}),
				(mEe = class {
					constructor() {
						;(this.conflicts = []), (this.merges = []), (this.result = "success")
					}
					get failed() {
						return this.conflicts.length > 0
					}
					get reason() {
						return this.result
					}
					toString() {
						return this.conflicts.length ? `CONFLICTS: ${this.conflicts.join(", ")}` : "OK"
					}
				})
		},
	}),
	z4,
	yEe,
	bAt = Se({
		"src/lib/responses/PullSummary.ts"() {
			"use strict"
			;(z4 = class {
				constructor() {
					;(this.remoteMessages = { all: [] }),
						(this.created = []),
						(this.deleted = []),
						(this.files = []),
						(this.deletions = {}),
						(this.insertions = {}),
						(this.summary = { changes: 0, deletions: 0, insertions: 0 })
				}
			}),
				(yEe = class {
					constructor() {
						;(this.remote = ""),
							(this.hash = { local: "", remote: "" }),
							(this.branch = { local: "", remote: "" }),
							(this.message = "")
					}
					toString() {
						return this.message
					}
				})
		},
	})