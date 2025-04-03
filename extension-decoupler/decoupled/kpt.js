
function Kpt() {
	return {
		checkout() {
			return this._runTask(N4(zo(arguments, 1)), ci(arguments))
		},
		checkoutBranch(e, t) {
			return this._runTask(N4(["-b", e, t, ...zo(arguments)]), ci(arguments))
		},
		checkoutLocalBranch(e) {
			return this._runTask(N4(["-b", e, ...zo(arguments)]), ci(arguments))
		},
	}
}