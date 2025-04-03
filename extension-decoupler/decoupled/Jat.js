
function jAt(e) {
	let t = $Ee(e),
		r = ["branch", ...e]
	return (
		r.length === 1 && r.push("-a"),
		r.includes("-v") || r.splice(1, 0, "-v"),
		{
			format: "utf-8",
			commands: r,
			parser(n, i) {
				return t ? $M(n, i).all[0] : HEe(n)
			},
		}
	)
}