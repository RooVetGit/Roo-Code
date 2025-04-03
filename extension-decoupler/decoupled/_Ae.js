
var _Ae = x((dRt, xAe) => {
	"use strict"
	var KH = class {
		constructor(t) {
			let r = KR()
			if (typeof t != "object" || Array.isArray(t) || !(t instanceof r))
				throw new Error("Logger is required for profiling")
			;(this.logger = t), (this.start = Date.now())
		}
		done(...t) {
			typeof t[t.length - 1] == "function" &&
				(console.warn("Callback function no longer supported as of winston@3.0.0"), t.pop())
			let r = typeof t[t.length - 1] == "object" ? t.pop() : {}
			return (r.level = r.level || "info"), (r.durationMs = Date.now() - this.start), this.logger.write(r)
		}
	}
	xAe.exports = KH
})