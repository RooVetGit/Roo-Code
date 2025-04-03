
function Tpt(e) {
	let t = ["config", "--list", "--show-origin", "--null"]
	return (
		e && t.push(`--${e}`),
		{
			commands: t,
			format: "utf-8",
			parser(r) {
				return _pt(r)
			},
		}
	)
}