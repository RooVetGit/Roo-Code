
function YCe(e) {
	return e.length
		? {
				commands: ["merge", ...e],
				format: "utf-8",
				parser(t, r) {
					let n = IEe(t, r)
					if (n.failed) throw new e_(n)
					return n
				},
			}
		: jo("Git.merge requires at least one option")
}