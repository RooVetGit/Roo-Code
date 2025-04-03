
function Lmt(e) {
	return {
		format: "utf-8",
		commands: ["tag", e],
		parser() {
			return { name: e }
		},
	}
}