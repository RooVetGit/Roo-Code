
var Xve = Se({
		"src/lib/git-logger.ts"() {
			"use strict"
			wt(),
				(NM.default.formatters.L = (e) => String(iG(e) ? e.length : "-")),
				(NM.default.formatters.B = (e) => (Buffer.isBuffer(e) ? e.toString("utf8") : r_(e)))
		},
	}),
	BM,
	Y4,
	Opt = Se({
		"src/lib/runners/tasks-pending-queue.ts"() {
			"use strict"
			Hh(),
				Xve(),
				(BM = class {
					constructor(e = "GitExecutor") {
						;(this.logLabel = e), (this._queue = new Map())
					}
					withProgress(e) {
						return this._queue.get(e)
					}
					createProgress(e) {
						let t = BM.getName(e.commands[0]),
							r = fG(this.logLabel, t)
						return { task: e, logger: r, name: t }
					}
					push(e) {
						let t = this.createProgress(e)
						return t.logger("Adding task to the queue, commands = %o", e.commands), this._queue.set(e, t), t
					}
					fatal(e) {
						for (let [t, { logger: r }] of Array.from(this._queue.entries()))
							t === e.task
								? (r.info("Failed %o", e),
									r(
										"Fatal exception, any as-yet un-started tasks run through this executor will not be attempted",
									))
								: r.info(
										"A fatal exception occurred in a previous task, the queue has been purged: %o",
										e.message,
									),
								this.complete(t)
						if (this._queue.size !== 0)
							throw new Error(`Queue size should be zero after fatal: ${this._queue.size}`)
					}
					complete(e) {
						this.withProgress(e) && this._queue.delete(e)
					}
					attempt(e) {
						let t = this.withProgress(e)
						if (!t) throw new ef(void 0, "TasksPendingQueue: attempt called for an unknown task")
						return t.logger("Starting task"), t
					}
					static getName(e = "empty") {
						return `task:${e}:${++BM.counter}`
					}
				}),
				(Y4 = BM),
				(Y4.counter = 0)
		},
	})