
function Kmt(e) {
	let t = zx(e, "-c")
	return {
		type: "spawn.args",
		action(r) {
			return [...t, ...r]
		},
	}
}