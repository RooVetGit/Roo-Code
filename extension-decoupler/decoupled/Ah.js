
var AH = x((ATt, sge) => {
	"use strict"
	var hot = require("util"),
		{ LEVEL: pH } = Bi(),
		ige = Dh(),
		Zb = (sge.exports = function (t = {}) {
			if ((ige.call(this, t), !t.transport || typeof t.transport.log != "function"))
				throw new Error("Invalid transport, must be an object with a log method.")
			;(this.transport = t.transport),
				(this.level = this.level || t.transport.level),
				(this.handleExceptions = this.handleExceptions || t.transport.handleExceptions),
				this._deprecated()
			function r(n) {
				this.emit("error", n, this.transport)
			}
			this.transport.__winstonError ||
				((this.transport.__winstonError = r.bind(this)),
				this.transport.on("error", this.transport.__winstonError))
		})
	hot.inherits(Zb, ige)
	Zb.prototype._write = function (t, r, n) {
		if (this.silent || (t.exception === !0 && !this.handleExceptions)) return n(null)
		;(!this.level || this.levels[this.level] >= this.levels[t[pH]]) &&
			this.transport.log(t[pH], t.message, t, this._nop),
			n(null)
	}
	Zb.prototype._writev = function (t, r) {
		for (let n = 0; n < t.length; n++)
			this._accept(t[n]) &&
				(this.transport.log(t[n].chunk[pH], t[n].chunk.message, t[n].chunk, this._nop), t[n].callback())
		return r(null)
	}
	Zb.prototype._deprecated = function () {
		console.error(
			[
				`${this.transport.name} is a legacy winston transport. Consider upgrading: `,
				"- Upgrade docs: https://github.com/winstonjs/winston/blob/master/UPGRADE-3.0.md",
			].join(`
`),
		)
	}
	Zb.prototype.close = function () {
		this.transport.close && this.transport.close(),
			this.transport.__winstonError &&
				(this.transport.removeListener("error", this.transport.__winstonError),
				(this.transport.__winstonError = null))
	}
})