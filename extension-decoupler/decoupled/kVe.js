
var $ve,
	Yx,
	kCe,
	Yve,
	Kve = Se({
		"src/lib/tasks/grep.ts"() {
			"use strict"
			wt(),
				Ci(),
				($ve = ["-h"]),
				(Yx = Symbol("grepQuery")),
				(Yve = class {
					constructor() {
						this[kCe] = []
					}
					*[((kCe = Yx), Symbol.iterator)]() {
						for (let e of this[Yx]) yield e
					}
					and(...e) {
						return e.length && this[Yx].push("--and", "(", ...zx(e, "-e"), ")"), this
					}
					param(...e) {
						return this[Yx].push(...zx(e, "-e")), this
					}
				})
		},
	}),
	Jve = {}