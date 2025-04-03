
function dyt(e, t) {
	let r = [],
		n = e.split("|"),
		i = t.split("|")
	;(0, yQ.default)(n.length === i.length)
	let s = 0,
		o = 0
	for (let a = 0; a < n.length; a++)
		r.push({
			original: { start: s, stop: s + n[a].length },
			updated: { start: o, stop: o + i[a].length },
		}),
			(s += n[a].length),
			(o += i[a].length)
	return r
}