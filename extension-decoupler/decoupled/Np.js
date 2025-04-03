
function NP(e, t, r) {
	var n, i, s
	if (e !== null && typeof e == "object")
		if (((i = t.indexOf(e)), i !== -1)) r.indexOf(i) === -1 && r.push(i)
		else if ((t.push(e), Array.isArray(e))) for (i = 0, s = e.length; i < s; i += 1) NP(e[i], t, r)
		else for (n = Object.keys(e), i = 0, s = n.length; i < s; i += 1) NP(e[n[i]], t, r)
}