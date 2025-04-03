
var Vve,
	Spt = Se({
		"src/lib/responses/ConfigList.ts"() {
			"use strict"
			wt(),
				(Vve = class {
					constructor() {
						;(this.files = []), (this.values = Object.create(null))
					}
					get all() {
						return (
							this._all ||
								(this._all = this.files.reduce((e, t) => Object.assign(e, this.values[t]), {})),
							this._all
						)
					}
					addFile(e) {
						if (!(e in this.values)) {
							let t = rA(this.files)
							;(this.values[e] = t ? Object.create(this.values[t]) : {}), this.files.push(e)
						}
						return this.values[e]
					}
					addValue(e, t, r) {
						let n = this.addFile(e)
						n.hasOwnProperty(t) ? (Array.isArray(n[t]) ? n[t].push(r) : (n[t] = [n[t], r])) : (n[t] = r),
							(this._all = void 0)
					}
				})
		},
	})