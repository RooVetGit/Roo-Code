
function XAt(e, t = !1) {
	return {
		format: "utf-8",
		commands: ["branch", "-v", t ? "-D" : "-d", ...e],
		parser(r, n) {
			return $M(r, n)
		},
		onError({ exitCode: r, stdOut: n }, i, s, o) {
			if (!qEe(String(i), r)) return o(i)
			s(n)
		},
	}
}