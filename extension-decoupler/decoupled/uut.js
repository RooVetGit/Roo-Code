
function Uut(e) {
	let t = {}
	for (let r = 0, n = e.length; r < n; r += 1) {
		let i = e.charAt(r)
		t[i] = (t[i] || 0) | (1 << (n - r - 1))
	}
	return t
}