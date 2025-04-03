
var XQ = class e {
	static defaultStartSeq = 1e4
	_next
	constructor(t = e.defaultStartSeq) {
		this._next = t
	}
	next() {
		return this._next++
	}
}