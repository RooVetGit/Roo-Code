
function UCe(e) {
	let t = /^\s*(\d+)/.exec(e),
		r = /delta (\d+)/i.exec(e)
	return { count: mn((t && t[1]) || "0"), delta: mn((r && r[1]) || "0") }
}