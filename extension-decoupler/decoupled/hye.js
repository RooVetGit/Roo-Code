
var Hye = x((uQt, Vye) => {
	"use strict"
	var yht = qx(),
		Cht = El()
	Vye.exports = (e, t, r) => {
		let n = [],
			i = null,
			s = null,
			o = e.sort((u, f) => Cht(u, f, r))
		for (let u of o) yht(u, t, r) ? ((s = u), i || (i = u)) : (s && n.push([i, s]), (s = null), (i = null))
		i && n.push([i, null])
		let a = []
		for (let [u, f] of n)
			u === f
				? a.push(u)
				: !f && u === o[0]
					? a.push("*")
					: f
						? u === o[0]
							? a.push(`<=${f}`)
							: a.push(`${u} - ${f}`)
						: a.push(`>=${u}`)
		let l = a.join(" || "),
			c = typeof t.raw == "string" ? t.raw : String(t)
		return l.length < c.length ? l : t
	}
})