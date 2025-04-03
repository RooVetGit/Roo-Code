
function Uve(e, t) {
	return {
		commands: ["clean", `-${e}`, ...t],
		format: "utf-8",
		parser(n) {
			return Apt(e === "n", n)
		},
	}
}