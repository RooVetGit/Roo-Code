
function jo(e) {
	return {
		commands: WM,
		format: "empty",
		parser() {
			throw typeof e == "string" ? new cve(e) : e
		},
	}
}