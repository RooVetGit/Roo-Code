
function FQe(e) {
	if (e === null) return []
	var t,
		r,
		n,
		i,
		s,
		o = e
	for (s = new Array(o.length), t = 0, r = o.length; t < r; t += 1)
		(n = o[t]), (i = Object.keys(n)), (s[t] = [i[0], n[i[0]]])
	return s
}