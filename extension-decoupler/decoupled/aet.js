
function Aet(e, t, r) {
	if (f3.randomUUID && !t && !e) return f3.randomUUID()
	e = e || {}
	let n = e.random || (e.rng || u3)()
	if (((n[6] = (n[6] & 15) | 64), (n[8] = (n[8] & 63) | 128), t)) {
		r = r || 0
		for (let i = 0; i < 16; ++i) t[r + i] = n[i]
		return t
	}
	return Eue(n)
}