
function SP() {
	let e = {}
	for (let t of E1e) {
		let r = Lv.default.env[t]
		r !== void 0 && (r.startsWith("()") || (e[t] = r))
	}
	return e
}