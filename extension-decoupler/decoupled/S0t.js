
function s0t(e) {
	let t = Cve(e, ["uid", "gid"])
	return {
		type: "spawn.options",
		action(r) {
			return _l(_l({}, t), r)
		},
	}
}