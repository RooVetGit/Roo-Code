
var K4,
	Vpt = Se({
		"src/lib/runners/git-executor-chain.ts"() {
			"use strict"
			Hh(),
				Ci(),
				wt(),
				Opt(),
				(K4 = class {
					constructor(e, t, r) {
						;(this._executor = e),
							(this._scheduler = t),
							(this._plugins = r),
							(this._chain = Promise.resolve()),
							(this._queue = new Y4())
					}
					get cwd() {
						return this._cwd || this._executor.cwd
					}
					set cwd(e) {
						this._cwd = e
					}
					get env() {
						return this._executor.env
					}
					get outputHandler() {
						return this._executor.outputHandler
					}
					chain() {
						return this
					}
					push(e) {
						return this._queue.push(e), (this._chain = this._chain.then(() => this.attemptTask(e)))
					}
					attemptTask(e) {
						return Kx(this, null, function* () {
							let t = yield this._scheduler.next(),
								r = () => this._queue.complete(e)
							try {
								let { logger: n } = this._queue.attempt(e)
								return yield Pve(e) ? this.attemptEmptyTask(e, n) : this.attemptRemoteTask(e, n)
							} catch (n) {
								throw this.onFatalException(e, n)
							} finally {
								r(), t()
							}
						})
					}
					onFatalException(e, t) {
						let r = t instanceof ef ? Object.assign(t, { task: e }) : new ef(e, t && String(t))
						return (this._chain = Promise.resolve()), this._queue.fatal(r), r
					}
					attemptRemoteTask(e, t) {
						return Kx(this, null, function* () {
							let r = this._plugins.exec("spawn.binary", "", tA(e, e.commands)),
								n = this._plugins.exec("spawn.args", [...e.commands], tA(e, e.commands)),
								i = yield this.gitResponse(e, r, n, this.outputHandler, t.step("SPAWN")),
								s = yield this.handleTaskData(e, n, i, t.step("HANDLE"))
							return (
								t("passing response to task's parser as a %s", e.format),
								Nve(e) ? H4(e.parser, s) : H4(e.parser, s.asStrings())
							)
						})
					}
					attemptEmptyTask(e, t) {
						return Kx(this, null, function* () {
							return t("empty task bypassing child process to call to task's parser"), e.parser(this)
						})
					}
					handleTaskData(e, t, r, n) {
						let { exitCode: i, rejection: s, stdOut: o, stdErr: a } = r
						return new Promise((l, c) => {
							n("Preparing to handle process response exitCode=%d stdOut=", i)
							let { error: u } = this._plugins.exec("task.error", { error: s }, _l(_l({}, tA(e, t)), r))
							if (u && e.onError)
								return (
									n.info("exitCode=%s handling with custom error handler"),
									e.onError(
										r,
										u,
										(f) => {
											n.info("custom error handler treated as success"),
												n("custom error returned a %s", r_(f)),
												l(new Zx(Array.isArray(f) ? Buffer.concat(f) : f, Buffer.concat(a)))
										},
										c,
									)
								)
							if (u)
								return (
									n.info("handling as error: exitCode=%s stdErr=%s rejection=%o", i, a.length, s),
									c(u)
								)
							n.info("retrieving task output complete"), l(new Zx(Buffer.concat(o), Buffer.concat(a)))
						})
					}
					gitResponse(e, t, r, n, i) {
						return Kx(this, null, function* () {
							let s = i.sibling("output"),
								o = this._plugins.exec(
									"spawn.options",
									{ cwd: this.cwd, env: this.env, windowsHide: !0 },
									tA(e, e.commands),
								)
							return new Promise((a) => {
								let l = [],
									c = []
								i.info("%s %o", t, r), i("%O", o)
								let u = this._beforeSpawn(e, r)
								if (u)
									return a({
										stdOut: l,
										stdErr: c,
										exitCode: 9901,
										rejection: u,
									})
								this._plugins.exec(
									"spawn.before",
									void 0,
									Jx(_l({}, tA(e, r)), {
										kill(p) {
											u = p || u
										},
									}),
								)
								let f = (0, eEe.spawn)(t, r, o)
								f.stdout.on("data", FCe(l, "stdOut", i, s.step("stdOut"))),
									f.stderr.on("data", FCe(c, "stdErr", i, s.step("stdErr"))),
									f.on("error", qpt(c, i)),
									n &&
										(i("Passing child process stdOut/stdErr to custom outputHandler"),
										n(t, f.stdout, f.stderr, [...r])),
									this._plugins.exec(
										"spawn.after",
										void 0,
										Jx(_l({}, tA(e, r)), {
											spawned: f,
											close(p, g) {
												a({
													stdOut: l,
													stdErr: c,
													exitCode: p,
													rejection: u || g,
												})
											},
											kill(p) {
												f.killed || ((u = p), f.kill("SIGINT"))
											},
										}),
									)
							})
						})
					}
					_beforeSpawn(e, t) {
						let r
						return (
							this._plugins.exec(
								"spawn.before",
								void 0,
								Jx(_l({}, tA(e, t)), {
									kill(n) {
										r = n || r
									},
								}),
							),
							r
						)
					}
				})
		},
	}),
	tEe = {}