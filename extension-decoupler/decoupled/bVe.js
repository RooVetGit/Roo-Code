
function Bve() {
	return {
		commands: ["rev-parse", "--is-bare-repository"],
		format: "utf-8",
		onError: HM,
		parser: aG,
	}
}