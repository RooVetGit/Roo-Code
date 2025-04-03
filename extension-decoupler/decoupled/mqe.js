
function MQe(e) {
	if (e === null) return !0
	var t,
		r,
		n,
		i,
		s,
		o = e
	for (s = new Array(o.length), t = 0, r = o.length; t < r; t += 1) {
		if (((n = o[t]), kQe.call(n) !== "[object Object]" || ((i = Object.keys(n)), i.length !== 1))) return !1
		s[t] = [i[0], n[i[0]]]
	}
	return !0
}