
function PQe(e) {
	if (e === null) return !0
	var t,
		r = e
	for (t in r) if (NQe.call(r, t) && r[t] !== null) return !1
	return !0
}