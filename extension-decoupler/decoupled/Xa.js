
var xA = class {
	constructor(t, r = new M_()) {
		this.maxQueueSizeChars = t
		this._queue = r
	}
	addEvent(t, r) {
		let n = this._queue.newest(),
			i = n?.afterBlobName === r,
			s = 0,
			o = i ? void 0 : n?.mergeNext(t)
		if (o !== void 0) {
			let a = this._queue.removeNew()
			;(s -= a?.changedChars() ?? 0), o.hasChange() && (s += this._queue.add(o))
		} else s += this._queue.add(t)
		for (; this._queue.sizeChars > this.maxQueueSizeChars; ) this._queue.removeOld()
		return s
	}
	removeEventsForFile(t) {
		for (let r = this._queue.numEvents - 1; r >= 0; r--) {
			let n = this._queue.at(r)
			n !== void 0 && n.path === t && this._queue.removeAt(r)
		}
	}
	removeEventsPriorToBlob(t) {
		let r = null
		for (let n = this._queue.numEvents - 1; n >= 0; n--) {
			let i = this._queue.at(n)
			if (!r && i?.beforeBlobName === t) {
				r = i.path
				continue
			}
			r && i?.path === r && this._queue.removeAt(n)
		}
	}
	updatePath(t, r) {
		for (let n = 0; n < this._queue.numEvents; n++) {
			let i = this._queue.at(n)
			i !== void 0 && i.path === t && (i.path = r)
		}
	}
	getEvents() {
		return this._queue.asArray()
	}
	clear() {
		this._queue.clear()
	}
}