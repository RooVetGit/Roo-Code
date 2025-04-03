
function E_e(e, t) {
	let r = e.toString()
	return t - yl(r) >= 0 ? r + " ".repeat(t - r.length) : r
}