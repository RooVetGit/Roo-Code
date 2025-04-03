
function Umt(e, t) {
	return {
		format: "utf-8",
		commands: ["tag", "-a", "-m", t, e],
		parser() {
			return { name: e }
		},
	}
}