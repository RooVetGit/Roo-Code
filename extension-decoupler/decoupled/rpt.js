
function Rpt() {
	return {
		addConfig(e, t, ...r) {
			return this._runTask(Bpt(e, t, r[0] === !0, F4(r[1], "local")), ci(arguments))
		},
		getConfig(e, t) {
			return this._runTask(Dpt(e, F4(t, void 0)), ci(arguments))
		},
		listConfig(...e) {
			return this._runTask(Tpt(F4(e[0], void 0)), ci(arguments))
		},
	}
}