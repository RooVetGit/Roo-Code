
var V_ = class extends Error {
		constructor(r, n) {
			let i = r instanceof Error ? r.message : `${r}`
			super(`WorkQueueItemFailed: ${i}, retry = ${n}`)
			this.toThrow = r
			this.retry = n
		}
	},
	i6 = class {
		throwError(t, r) {
			throw new V_(t, r)
		}
	},
	s6 = class {
		progressReporter
		completedItems = 0
		totalItems
		constructor(t, r) {
			;(this.progressReporter = t), (this.totalItems = r), this.update(0, this.totalItems)
		}
		update(t, r) {
			;(this.completedItems += t),
				(this.totalItems = this.completedItems + r),
				this.progressReporter.update(this.completedItems, this.totalItems)
		}
		cancel() {
			this.progressReporter.cancel()
		}
	},
	o6 = class {
		constructor(t, r) {
			this.item = t
			this.process = r
		}
		itemCount() {
			return 1
		}
		start(t) {
			return this.process(this.item, t)
		}
	},
	a6 = class {
		constructor(t, r) {
			this.items = t
			this.process = r
		}
		itemCount() {
			return this.items.size
		}
		start(t) {
			return this.process(this.items, t)
		}
	},
	gN = class {
		queue = new Set()
		get size() {
			return this.queue.size
		}
		add(t) {
			this.queue.add(t)
		}
		delete(t) {
			this.queue.delete(t)
		}
	},
	l6 = class extends gN {
		constructor(r) {
			super()
			this.process = r
		}
		dequeue() {
			let r = this.queue.values().next()
			if (r.done) throw new Error("Cannot dequeue from empty queue")
			let n = r.value
			return this.queue.delete(n), new o6(n, this.process)
		}
	},
	c6 = class extends gN {
		constructor(r, n) {
			super()
			this.process = r
			this._maxBatchSize = n
		}
		dequeue() {
			let r
			if (this._maxBatchSize === void 0 || this.queue.size <= this._maxBatchSize)
				(r = this.queue), (this.queue = new Set())
			else {
				r = new Set()
				let n = this.queue.values()
				for (let i = 0; i < this._maxBatchSize; i++) {
					let s = n.next()
					if (s.done) break
					let o = s.value
					this.queue.delete(o), r.add(o)
				}
			}
			return new a6(r, this.process)
		}
	},
	pN = class e {
		constructor(t, r, n, i) {
			this.name = t
			this.shutdownError = n
			if ("processOne" in r) this.queue = new l6(r.processOne)
			else if ("processBatch" in r) this.queue = new c6(r.processBatch, r.maxBatchSize)
			else throw new Error("Invalid processor type")
			;(this.backoffParams = i || e.defaultBackoffParams),
				(this.logger = X(`WorkQueue[${t}]`)),
				(this.errorHandler = new i6())
		}
		static queueStatusChanged = "QueueStatusChanged"
		static itemFailed = "ItemFailed"
		static defaultBackoffParams = { initialMS: 100, mult: 2, maxMS: 3e4 }
		eventEmitters = {
			[e.queueStatusChanged]: new n6.EventEmitter(),
			[e.itemFailed]: new n6.EventEmitter(),
		}
		queue
		countReporters = new Set()
		progressReporters = new Set()
		errorHandler
		backoffParams
		itemsInProgress = 0
		stopping = !1
		logger
		stop() {
			;(this.stopping = !0), this.update(), this.notifyStatusChanged()
		}
		add(t) {
			this.stopping || (this.queue.add(t), this.update(), this.kick())
		}
		delete(t) {
			this.stopping || (this.queue.delete(t), this.update())
		}
		size() {
			return this.queue.size + this.itemsInProgress
		}
		reportQueueSize(t) {
			let r = this.size()
			t.update(r), this.countReporters.add(t)
		}
		awaitEmpty(t, r = !0) {
			if (this.stopping) return Promise.resolve()
			let n = this.size()
			return n === 0
				? Promise.resolve()
				: (t && this.progressReporters.add(new s6(t, n)),
					new Promise((i, s) => {
						let o = []
						function a() {
							for (let l of o) l.dispose()
						}
						o.push(
							this.eventEmitters[e.queueStatusChanged].event(() => {
								a(), this.stopping ? s(this.shutdownError) : i()
							}),
						),
							r &&
								o.push(
									this.eventEmitters[e.itemFailed].event((l) => {
										a(), s(l)
									}),
								)
					}))
		}
		update(t = 0) {
			if (this.stopping) {
				for (let r of this.countReporters) r.cancel()
				for (let r of this.progressReporters) r.cancel()
			} else {
				this.itemsInProgress -= t
				let r = this.size()
				for (let n of this.countReporters) n.update(r)
				for (let n of this.progressReporters) n.update(t, r)
			}
		}
		notifyStatusChanged() {
			this.eventEmitters[e.queueStatusChanged].fire(null), this.progressReporters.clear()
		}
		notifyItemFailed(t) {
			let r = t instanceof V_ ? t.toThrow : t
			this.eventEmitters[e.itemFailed].fire(r)
		}
		delay(t) {
			return new Promise((r) => setTimeout(r, t))
		}
		async kick() {
			if (!this.itemsInProgress) {
				for (; !this.stopping && this.queue.size !== 0; ) {
					let t = this.queue.dequeue()
					this.itemsInProgress = t.itemCount()
					let r = 0,
						n = 0
					do {
						try {
							await t.start(this.errorHandler), n && this.logger.debug(`item succeeded; retries = ${n}`)
							break
						} catch (i) {
							if ((this.notifyItemFailed(i), !(i instanceof V_ && i.retry))) {
								this.logger.debug(`item failed, not retrying; retries = ${n}`)
								break
							}
						}
						this.logger.debug(`item failed, retrying in ${r} ms; retries = ${n}`),
							await this.delay(r),
							this.logger.debug("retrying"),
							r === 0
								? (r = this.backoffParams.initialMS)
								: (r = Math.min(r * this.backoffParams.mult, this.backoffParams.maxMS)),
							n++
					} while (!this.stopping)
					this.stopping || this.update(this.itemsInProgress)
				}
				this.notifyStatusChanged()
			}
		}
	}