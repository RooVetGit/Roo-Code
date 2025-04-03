
var Rre = x((vIt, Tre) => {
	"use strict"
	var { kFree: T8e, kConnected: R8e, kPending: k8e, kQueued: M8e, kRunning: F8e, kSize: Q8e } = Qn(),
		lp = Symbol("pool"),
		hq = class {
			constructor(t) {
				this[lp] = t
			}
			get connected() {
				return this[lp][R8e]
			}
			get free() {
				return this[lp][T8e]
			}
			get pending() {
				return this[lp][k8e]
			}
			get queued() {
				return this[lp][M8e]
			}
			get running() {
				return this[lp][F8e]
			}
			get size() {
				return this[lp][Q8e]
			}
		}
	Tre.exports = hq
})