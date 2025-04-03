
function Ymt({ allowUnsafeProtocolOverride: e = !1, allowUnsafePack: t = !1 } = {}) {
	return {
		type: "spawn.args",
		action(r, n) {
			return (
				r.forEach((i, s) => {
					let o = s < r.length ? r[s + 1] : ""
					e || Gmt(i, o), t || $mt(i, n.method)
				}),
				r
			)
		},
	}
}