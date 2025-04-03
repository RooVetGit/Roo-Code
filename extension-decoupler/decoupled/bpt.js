
function Bpt(e, t, r, n) {
	let i = ["config", `--${n}`]
	return (
		r && i.push("--add"),
		i.push(e, t),
		{
			commands: i,
			format: "utf-8",
			parser(s) {
				return s
			},
		}
	)
}