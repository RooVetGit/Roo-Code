
var j4,
	qAt = Se({
		"src/lib/simple-git-api.ts"() {
			"use strict"
			$pt(),
				Ypt(),
				Jpt(),
				Zpt(),
				nAt(),
				Hve(),
				sAt(),
				Kve(),
				aAt(),
				fAt(),
				AEe(),
				IAt(),
				DEe(),
				RAt(),
				NAt(),
				Ci(),
				OAt(),
				wt(),
				(j4 = class {
					constructor(e) {
						this._executor = e
					}
					_runTask(e, t) {
						let r = this._executor.chain(),
							n = r.push(e)
						return (
							t && Wpt(e, n, t),
							Object.create(this, {
								then: { value: n.then.bind(n) },
								catch: { value: n.catch.bind(n) },
								_executor: { value: r },
							})
						)
					}
					add(e) {
						return this._runTask(mo(["add", ...Nu(e)]), ci(arguments))
					}
					cwd(e) {
						let t = ci(arguments)
						return typeof e == "string"
							? this._runTask(QCe(e, this._executor), t)
							: typeof e?.path == "string"
								? this._runTask(QCe(e.path, (e.root && this._executor) || void 0), t)
								: this._runTask(jo("Git.cwd: workingDirectory must be supplied as a string"), t)
					}
					hashObject(e, t) {
						return this._runTask(oAt(e, t === !0), ci(arguments))
					}
					init(e) {
						return this._runTask(dAt(e === !0, this._executor.cwd, zo(arguments)), ci(arguments))
					}
					merge() {
						return this._runTask(YCe(zo(arguments)), ci(arguments))
					}
					mergeFromTo(e, t) {
						return $s(e) && $s(t)
							? this._runTask(YCe([e, t, ...zo(arguments)]), ci(arguments, !1))
							: this._runTask(
									jo(
										"Git.mergeFromTo requires that the 'remote' and 'branch' arguments are supplied as strings",
									),
								)
					}
					outputHandler(e) {
						return (this._executor.outputHandler = e), this
					}
					push() {
						let e = EG({ remote: Pu(arguments[0], $s), branch: Pu(arguments[1], $s) }, zo(arguments))
						return this._runTask(e, ci(arguments))
					}
					stash() {
						return this._runTask(mo(["stash", ...zo(arguments)]), ci(arguments))
					}
					status() {
						return this._runTask(QAt(zo(arguments)), ci(arguments))
					}
				}),
				Object.assign(j4.prototype, Kpt(), rAt(), Rpt(), jpt(), iAt(), Qpt(), vAt(), TAt(), LAt())
		},
	}),
	NEe = {}