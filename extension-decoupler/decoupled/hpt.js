
var rEe,
	Hpt = Se({
		"src/lib/runners/git-executor.ts"() {
			"use strict"
			Vpt(),
				(rEe = class {
					constructor(e, t, r) {
						;(this.cwd = e),
							(this._scheduler = t),
							(this._plugins = r),
							(this._chain = new K4(this, this._scheduler, this._plugins))
					}
					chain() {
						return new K4(this, this._scheduler, this._plugins)
					}
					push(e) {
						return this._chain.push(e)
					}
				})
		},
	})