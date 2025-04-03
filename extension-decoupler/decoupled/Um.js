
var UM,
	Xx = Se({
		"src/lib/args/pathspec.ts"() {
			"use strict"
			UM = new WeakMap()
		},
	}),
	ef,
	Hh = Se({
		"src/lib/errors/git-error.ts"() {
			"use strict"
			ef = class extends Error {
				constructor(e, t) {
					super(t), (this.task = e), Object.setPrototypeOf(this, new.target.prototype)
				}
			}
		},
	}),
	e_,
	Vy = Se({
		"src/lib/errors/git-response-error.ts"() {
			"use strict"
			Hh(),
				(e_ = class extends ef {
					constructor(e, t) {
						super(void 0, t || String(e)), (this.git = e)
					}
				})
		},
	}),
	cve,
	uve = Se({
		"src/lib/errors/task-configuration-error.ts"() {
			"use strict"
			Hh(),
				(cve = class extends ef {
					constructor(e) {
						super(void 0, e)
					}
				})
		},
	})