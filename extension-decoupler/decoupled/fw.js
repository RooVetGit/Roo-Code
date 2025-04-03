
function FW(e, t) {
	for (let r = 0, n = MW.length; r < n; r += 1) {
		let i = MW[r]
		if (i.condition(e, t)) return new i(e, t)
	}
	return new xk(e, t)
}