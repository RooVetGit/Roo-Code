
function tdt(e, t) {
	let r = Fx.normalize(e),
		n = Fx.normalize(t)
	if (n.length > r.length) return !1
	if (r.endsWith(n)) {
		let i = r.length - n.length
		return i === 0 || r[i - 1] === Fx.sep
	}
	return !1
}