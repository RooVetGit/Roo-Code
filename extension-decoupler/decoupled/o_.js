
var dwe = X("SimpleQueueProcessor"),
	O_ = class {
		queue
		_inProgress = !1
		_disposed = !1
		constructor(t = new uN()) {
			this.queue = t
		}
		enqueue(t) {
			return this.queue.enqueue(t)
		}
		dequeue() {
			return this.queue.dequeue()
		}
		isEmpty() {
			return this.queue.isEmpty()
		}
		clear() {
			this.queue.clear()
		}
		peek() {
			return this.queue.peek()
		}
		getItems() {
			return this.queue.getItems()
		}
		size() {
			return this.queue.size()
		}
		dispose() {
			this._disposed = !0
		}
		retry(t, r) {
			setTimeout(() => {
				for (let n of t) this.enqueue(n)
				this.startProcess()
			}, r)
		}
		startProcess() {
			this._inProgress ||
				((this._inProgress = !0),
				Promise.resolve()
					.then(async () => {
						for (; !this.isEmpty() && !this.isDisposed(); ) {
							let t = this.peek()
							if ((await this.internalProcess(), t === this.peek())) break
						}
					})
					.catch((t) => {
						t instanceof Error
							? dwe.info(`Unhandled error while processing task: ${t.message} ${t.stack}`)
							: dwe.info(`Unhandled error while processing task: ${t}`)
					})
					.finally(() => {
						this._inProgress = !1
					}))
		}
		isDisposed() {
			return this._disposed
		}
	}