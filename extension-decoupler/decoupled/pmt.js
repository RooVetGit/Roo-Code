
function Pmt(e = []) {
	let t = e.some((r) => /^--sort=/.test(r))
	return {
		format: "utf-8",
		commands: ["tag", "-l", ...e],
		parser(r) {
			return abe(r, t)
		},
	}
}