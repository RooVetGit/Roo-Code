
var _1 = class extends x1 {
	requestStart
	emitTime
	constructor(t = Date.now(), r, n, i) {
		super(), (this.requestStart = t), (this.rpcStart = r), (this.rpcEnd = n), (this.emitTime = i)
	}
	isComplete() {
		return [this.rpcStart, this.rpcEnd, this.emitTime].every((r) => r !== void 0)
	}
}