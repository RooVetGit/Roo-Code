
var eg = class extends z {
	constructor(r = 100, n = () => !0) {
		super()
		this._itemVerifier = n
		;(this._ringBuffer = new Gc(r)), this.addDisposable(this._newItemEventEmitter)
	}
	_ringBuffer
	_newItemEventEmitter = new Zxe.EventEmitter()
	get onNewItems() {
		return this._newItemEventEmitter.event
	}
	get items() {
		return this._ringBuffer.slice()
	}
	get mostRecentItem() {
		return this._ringBuffer.at(-1)
	}
	addItem(r) {
		this._itemVerifier(r) && (this._ringBuffer.addItem(r), this._newItemEventEmitter.fire(r))
	}
}