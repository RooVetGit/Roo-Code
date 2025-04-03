
var JS = class {
	_broker
	constructor(t, r) {
		this._broker = new KS()
		let n = [new $S(t), new YS(r)]
		for (let i of n) this._broker.registerHandler(i)
	}
	onMessage(t, r) {
		return this._broker.handle(t, r)
	}
}