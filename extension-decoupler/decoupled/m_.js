
var M_ = class {
	_events = new Y_e.default()
	_queueSizeChars = 0
	constructor() {}
	add(t) {
		return this._events.push(t), this._updateState(t, "ADDED")
	}
	_updateState(t, r) {
		return t === void 0
			? 0
			: (r === "ADDED"
					? (this._queueSizeChars += t.changedChars() ?? 0)
					: (this._queueSizeChars -= t.changedChars() ?? 0),
				t.changedChars() ?? 0)
	}
	removeOld() {
		let t = this._events.shift()
		return this._updateState(t, "REMOVED"), t
	}
	removeNew() {
		let t = this._events.pop()
		return this._updateState(t, "REMOVED"), t
	}
	newest() {
		if (this._events.length !== 0) return this.at(this._events.length - 1)
	}
	asArray() {
		return this._events.toArray()
	}
	get numEvents() {
		return this._events.length
	}
	get sizeChars() {
		return this._queueSizeChars
	}
	at(t) {
		return this._events.get(t)
	}
	removeAt(t) {
		let r = this._events.get(t)
		this._updateState(r, "REMOVED"), this._events.removeOne(t)
	}
	clear() {
		this._events.clear(), (this._queueSizeChars = 0)
	}
}