
var n_,
	$s,
	Eve,
	QM,
	iG,
	bve = Se({
		"src/lib/utils/argument-filters.ts"() {
			"use strict"
			VM(),
				Xx(),
				(n_ = (e) => Array.isArray(e)),
				($s = (e) => typeof e == "string"),
				(Eve = (e) => Array.isArray(e) && e.every($s)),
				(QM = (e) => $s(e) || (Array.isArray(e) && e.every($s))),
				(iG = (e) =>
					e == null || "number|boolean|function".includes(typeof e)
						? !1
						: Array.isArray(e) || typeof e == "string" || typeof e.length == "number")
		},
	}),
	V4,
	apt = Se({
		"src/lib/utils/exit-codes.ts"() {
			"use strict"
			V4 = ((e) => (
				(e[(e.SUCCESS = 0)] = "SUCCESS"),
				(e[(e.ERROR = 1)] = "ERROR"),
				(e[(e.NOT_FOUND = -2)] = "NOT_FOUND"),
				(e[(e.UNCLEAN = 128)] = "UNCLEAN"),
				e
			))(V4 || {})
		},
	}),
	Zx,
	lpt = Se({
		"src/lib/utils/git-output-streams.ts"() {
			"use strict"
			Zx = class {
				constructor(e, t) {
					;(this.stdOut = e), (this.stdErr = t)
				}
				asStrings() {
					return new Zx(this.stdOut.toString("utf8"), this.stdErr.toString("utf8"))
				}
			}
		},
	}),
	Ft,
	Vh,
	cpt = Se({
		"src/lib/utils/line-parser.ts"() {
			"use strict"
			;(Ft = class {
				constructor(e, t) {
					;(this.matches = []),
						(this.parse = (r, n) => (
							this.resetMatches(),
							this._regExp.every((i, s) => this.addMatch(i, s, r(s)))
								? this.useMatches(n, this.prepareMatches()) !== !1
								: !1
						)),
						(this._regExp = Array.isArray(e) ? e : [e]),
						t && (this.useMatches = t)
				}
				useMatches(e, t) {
					throw new Error("LineParser:useMatches not implemented")
				}
				resetMatches() {
					this.matches.length = 0
				}
				prepareMatches() {
					return this.matches
				}
				addMatch(e, t, r) {
					let n = r && e.exec(r)
					return n && this.pushMatch(t, n), !!n
				}
				pushMatch(e, t) {
					this.matches.push(...t.slice(1))
				}
			}),
				(Vh = class extends Ft {
					addMatch(e, t, r) {
						return /^remote:\s/.test(String(r)) && super.addMatch(e, t, r)
					}
					pushMatch(e, t) {
						;(e > 0 || t.length > 1) && super.pushMatch(e, t)
					}
				})
		},
	})