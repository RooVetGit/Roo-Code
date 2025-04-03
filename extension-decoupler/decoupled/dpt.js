
function Dpt(e, t) {
	let r = ["config", "--null", "--show-origin", "--get-all", e]
	return (
		t && r.splice(1, 0, `--${t}`),
		{
			commands: r,
			format: "utf-8",
			parser(n) {
				return wpt(n, e)
			},
		}
	)
}