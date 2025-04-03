
var SN = class {
	maxSize
	items
	constructor(t) {
		;(this.maxSize = t), (this.items = [])
	}
	add(t) {
		let r = this.items.indexOf(t)
		r !== -1 ? this.items.splice(r, 1) : this.items.length >= this.maxSize && this.items.shift(), this.items.push(t)
	}
	clear() {
		this.items = []
	}
	size() {
		return this.items.length
	}
	toArray() {
		return this.items.slice()
	}
}