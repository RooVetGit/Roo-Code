
function AAt(e) {
	let t = gG(e),
		r = ["diff"]
	return (
		t === "" && ((t = "--stat"), r.push("--stat=4096")),
		r.push(...e),
		GM(r) || { commands: r, format: "utf-8", parser: lEe(t) }
	)
}