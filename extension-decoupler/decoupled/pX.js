
var FAe = W(require("vscode")),
	kh = W(MAe()),
	QAe = W(Dh()),
	jH = class extends QAe.default {
		constructor(r) {
			super()
			this.outputChannel = r
			this._logFns.set("info", r.info),
				this._logFns.set("debug", r.debug),
				this._logFns.set("warn", r.warn),
				this._logFns.set("error", r.error),
				this._logFns.set("verbose", r.trace)
		}
		_logFns = new Map()
		log(r, n) {
			setImmediate(() => {
				this.emit("logged", r)
			})
			let i = [r.prefix ? `'${r.prefix}'` : "", r.message].join(" "),
				s = this._logFns.get(r.level)
			s ? s(i) : this.outputChannel.appendLine(i), n()
		}
	},
	px