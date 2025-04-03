
function mo(e, t = !1) {
	return {
		commands: e,
		format: "utf-8",
		parser(r) {
			return t ? String(r).trim() : r
		},
	}
}