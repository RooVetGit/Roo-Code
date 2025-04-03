
var XCe,
	LEe,
	VAt = Se({
		"src/lib/runners/scheduler.ts"() {
			"use strict"
			wt(),
				Xve(),
				(XCe = (() => {
					let e = 0
					return () => {
						e++
						let { promise: t, done: r } = (0, PEe.createDeferred)()
						return { promise: t, done: r, id: e }
					}
				})()),
				(LEe = class {
					constructor(e = 2) {
						;(this.concurrency = e),
							(this.logger = fG("", "scheduler")),
							(this.pending = []),
							(this.running = []),
							this.logger("Constructed, concurrency=%s", e)
					}
					schedule() {
						if (!this.pending.length || this.running.length >= this.concurrency) {
							this.logger(
								"Schedule attempt ignored, pending=%s running=%s concurrency=%s",
								this.pending.length,
								this.running.length,
								this.concurrency,
							)
							return
						}
						let e = Qr(this.running, this.pending.shift())
						this.logger("Attempting id=%s", e.id),
							e.done(() => {
								this.logger("Completing id=", e.id), qM(this.running, e), this.schedule()
							})
					}
					next() {
						let { promise: e, id: t } = Qr(this.pending, XCe())
						return this.logger("Scheduling id=%s", t), this.schedule(), e
					}
				})
		},
	}),
	UEe = {}