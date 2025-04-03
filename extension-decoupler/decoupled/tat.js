
function TAt() {
	return {
		showBuffer() {
			let e = ["show", ...zo(arguments, 1)]
			return e.includes("--binary") || e.splice(1, 0, "--binary"), this._runTask(Qve(e), ci(arguments))
		},
		show() {
			let e = ["show", ...zo(arguments, 1)]
			return this._runTask(mo(e), ci(arguments))
		},
	}
}