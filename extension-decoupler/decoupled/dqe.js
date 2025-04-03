
function DQe(e) {
	if (e === null) return !0
	var t = [],
		r,
		n,
		i,
		s,
		o,
		a = e
	for (r = 0, n = a.length; r < n; r += 1) {
		if (((i = a[r]), (o = !1), BQe.call(i) !== "[object Object]")) return !1
		for (s in i)
			if (SQe.call(i, s))
				if (!o) o = !0
				else return !1
		if (!o) return !1
		if (t.indexOf(s) === -1) t.push(s)
		else return !1
	}
	return !0
}