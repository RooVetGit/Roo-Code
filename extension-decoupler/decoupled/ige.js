
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