
function qNe(e, t) {
	var r = [],
		n = [],
		i,
		s
	for (NP(e, r, n), i = 0, s = n.length; i < s; i += 1) t.duplicates.push(r[n[i]])
	t.usedDuplicates = new Array(s)
}