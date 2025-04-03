
function oyt(e, t) {
	let r = [],
		n = 0,
		i = 0,
		s = 0
	for (; i < e.length || s < t.length; ) {
		if (n++ > 1e4) throw new Error("infinite loop in groupLines")
		for (; i < e.length && e[i].type !== "noop"; ) r.push(e[i]), i++
		for (; s < t.length && t[s].type !== "noop"; ) r.push(t[s]), s++
		for (; i < e.length && s < t.length && e[i].type === "noop" && t[s].type === "noop"; ) r.push(e[i]), i++, s++
	}
	return r
}