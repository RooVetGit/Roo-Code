
var SQ = class {
	constructor(t) {
		this._baseState = t
	}
	_stateEventEmitter = new BQ.EventEmitter()
	_state = { 0: [], 1: [], 2: [], 3: [] }
	onDidChangeState = this._stateEventEmitter.event
	setState(t) {
		this._state[t.priority].push(t)
		let r = !1
		return BQ.Disposable.from({
			dispose: () => {
				if (r) return
				r = !0
				let n = !1
				;(this._state[t.priority] = this._state[t.priority].filter((i) => (n ? !0 : ((n = i === t), !n)))),
					this._stateEventEmitter.fire()
			},
		})
	}
	getPriorityState() {
		for (let t of XG) {
			let r = this._state[t]
			if (r.length > 0) return r[r.length - 1]
		}
		return this._baseState
	}
	reset() {
		for (let t of XG) this._state[t] = []
		this._stateEventEmitter.fire()
	}
}