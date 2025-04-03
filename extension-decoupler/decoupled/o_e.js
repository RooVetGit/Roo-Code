
function O_e(e, t) {
	if (e.size !== t.size) return !1
	for (let [r, n] of e) if (t.get(r) !== n) return !1
	return !0
}