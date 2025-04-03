
var RAe = x((pRt, TAe) => {
	"use strict"
	var Tct = zH()
	TAe.exports = class {
		constructor(t = {}) {
			;(this.loggers = new Map()), (this.options = t)
		}
		add(t, r) {
			if (!this.loggers.has(t)) {
				r = Object.assign({}, r || this.options)
				let n = r.transports || this.options.transports
				n ? (r.transports = Array.isArray(n) ? n.slice() : [n]) : (r.transports = [])
				let i = Tct(r)
				i.on("close", () => this._delete(t)), this.loggers.set(t, i)
			}
			return this.loggers.get(t)
		}
		get(t, r) {
			return this.add(t, r)
		}
		has(t) {
			return !!this.loggers.has(t)
		}
		close(t) {
			if (t) return this._removeLogger(t)
			this.loggers.forEach((r, n) => this._removeLogger(n))
		}
		_removeLogger(t) {
			if (!this.loggers.has(t)) return
			this.loggers.get(t).close(), this._delete(t)
		}
		_delete(t) {
			this.loggers.delete(t)
		}
	}
})