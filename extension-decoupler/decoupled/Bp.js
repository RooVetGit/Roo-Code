
var BP = class extends HI {
	_capturedStdErr = []
	_capturing = !0
	async start() {
		await super.start()
		let t = this.stderr
		t &&
			t.on("data", (r) => {
				this._capturing && this._capturedStdErr.push(r.toString())
			})
	}
	get capturedStderr() {
		return this._capturedStdErr.join("")
	}
	stopCapturing() {
		this._capturing = !1
	}
}