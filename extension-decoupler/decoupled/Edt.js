
function edt(e, t) {
	if (e.score !== t.score) return e.score - t.score
	let r = e.matches?.[0].value,
		n = t.matches?.[0].value
	return r && n ? (r.length === n.length ? r.localeCompare(n) : r.length - n.length) : e.score - t.score
}