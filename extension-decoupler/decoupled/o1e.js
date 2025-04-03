
function O1e() {
	var e = {
			scalar: {},
			sequence: {},
			mapping: {},
			fallback: {},
			multi: { scalar: [], sequence: [], mapping: [], fallback: [] },
		},
		t,
		r
	function n(i) {
		i.multi ? (e.multi[i.kind].push(i), e.multi.fallback.push(i)) : (e[i.kind][i.tag] = e.fallback[i.tag] = i)
	}
	for (t = 0, r = arguments.length; t < r; t += 1) arguments[t].forEach(n)
	return e
}