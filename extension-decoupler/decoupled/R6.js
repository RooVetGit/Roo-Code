
var r6 = class {
	_size = 0
	_relPath = ""
	get size() {
		return this._size
	}
	add(t, r) {
		return this._relPath !== r ? ((this._size = t), (this._relPath = r)) : (this._size += t), this._size
	}
	clear() {
		;(this._size = 0), (this._relPath = "")
	}
}