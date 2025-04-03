
	var got = require("util"),
		oge = hR(),
		{ LEVEL: age } = Bi(),
		Xb = (mH.exports = function (t = {}) {
			oge.call(this, { objectMode: !0, highWaterMark: t.highWaterMark }),
				(this.format = t.format),
				(this.level = t.level),
				(this.handleExceptions = t.handleExceptions),
				(this.handleRejections = t.handleRejections),
				(this.silent = t.silent),
				t.log && (this.log = t.log),
				t.logv && (this.logv = t.logv),
				t.close && (this.close = t.close),
				this.once("pipe", (r) => {
					;(this.levels = r.levels), (this.parent = r)
				}),
				this.once("unpipe", (r) => {
					r === this.parent && ((this.parent = null), this.close && this.close())
				})
		})