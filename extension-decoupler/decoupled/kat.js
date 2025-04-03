
var eve,
	Z4,
	tve,
	$M,
	KAt = Se({
		"src/lib/parsers/parse-branch-delete.ts"() {
			"use strict"
			YAt(),
				wt(),
				(eve = /(\S+)\s+\(\S+\s([^)]+)\)/),
				(Z4 = /^error[^']+'([^']+)'/m),
				(tve = [
					new Ft(eve, (e, [t, r]) => {
						let n = GAt(t, r)
						e.all.push(n), (e.branches[t] = n)
					}),
					new Ft(Z4, (e, [t]) => {
						let r = $At(t)
						e.errors.push(r), e.all.push(r), (e.branches[t] = r)
					}),
				]),
				($M = (e, t) => Zo(new OEe(), tve, [e, t]))
		},
	}),
	VEe,
	JAt = Se({
		"src/lib/responses/BranchSummary.ts"() {
			"use strict"
			VEe = class {
				constructor() {
					;(this.all = []), (this.branches = {}), (this.current = ""), (this.detached = !1)
				}
				push(e, t, r, n, i) {
					e === "*" && ((this.detached = t), (this.current = r)),
						this.all.push(r),
						(this.branches[r] = {
							current: e === "*",
							linkedWorkTree: e === "+",
							name: r,
							commit: n,
							label: i,
						})
				}
			}
		},
	})