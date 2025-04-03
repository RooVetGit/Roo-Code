
var cf = class extends lt {
	constructor(r, n, i = !0) {
		super(n, i)
		this._config = r
	}
	type = "debug"
	canRun() {
		return this._config.config.enableDebugFeatures
	}
}