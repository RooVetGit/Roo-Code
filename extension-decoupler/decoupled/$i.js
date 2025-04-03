
function $I(e, t) {
	if (e.length <= t || e.length === 0) return e
	let r = e.split(`
`),
		i = "... additional lines truncated ..." + (r[0].endsWith("\r") ? "\r" : ""),
		s = ""
	if (r.length < 2 || r[0].length + r[r.length - 1].length + i.length > t) {
		let o = Math.floor(t / 2)
		s = [e.slice(0, o), "<...>", e.slice(-o)].join("")
	} else {
		let o = [],
			a = [],
			l = i.length + 1
		for (let c = 0; c < Math.floor(r.length / 2); c++) {
			let u = r[c],
				f = r[r.length - 1 - c],
				p = u.length + f.length + 2
			if (l + p > t) break
			;(l += p), o.push(u), a.push(f)
		}
		o.push(i),
			o.push(...a.reverse()),
			(s = o.join(`
`))
	}
	return s
}