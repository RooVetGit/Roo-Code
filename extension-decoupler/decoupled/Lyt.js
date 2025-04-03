
function lyt(e, t, r) {
	let n = e.map((s) => T_(s.spans.map((o) => o.text).join(""))),
		i = Math.max(t, n.map((s) => s.length).reduce((s, o) => Math.max(s, o), 0) - r.total())
	return {
		linePadAmounts: n.map((s) => i - Math.max(0, s.length - r.total()) + 1),
		longestLineLength: i,
	}
}