
var uN = class {
	_queue = new uwe.default()
	config
	constructor(t = {}) {
		this.config = {
			sizeLimit: t.sizeLimit ?? 1e6,
			queueSizeManagement: t.queueSizeManagement ?? "REMOVE_OLDEST",
		}
	}
	enqueue(t) {
		if (this._queue.length >= this.config.sizeLimit) {
			if (this.config.queueSizeManagement === "REJECT_NEW_ITEMS") return !1
			this.config.queueSizeManagement === "REMOVE_OLDEST" && this._queue.shift()
		}
		return this._queue.push(t), !0
	}
	dequeue() {
		return this._queue.shift()
	}
	isEmpty() {
		return this._queue.isEmpty()
	}
	clear() {
		this._queue.clear()
	}
	peek() {
		return this.peek()
	}
	getItems() {
		return Object.freeze(this._queue.toArray())
	}
	size() {
		return this._queue.length
	}
}