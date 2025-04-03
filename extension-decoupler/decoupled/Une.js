
function UNe(e, t, r) {
	var n = "",
		i = e.tag,
		s = Object.keys(r),
		o,
		a,
		l,
		c,
		u
	for (o = 0, a = s.length; o < a; o += 1)
		(u = ""),
			n !== "" && (u += ", "),
			e.condenseFlow && (u += '"'),
			(l = s[o]),
			(c = r[l]),
			e.replacer && (c = e.replacer.call(r, l, c)),
			vd(e, t, l, !1, !1) &&
				(e.dump.length > 1024 && (u += "? "),
				(u += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " ")),
				vd(e, t, c, !1, !1) && ((u += e.dump), (n += u)))
	;(e.tag = i), (e.dump = "{" + n + "}")
}