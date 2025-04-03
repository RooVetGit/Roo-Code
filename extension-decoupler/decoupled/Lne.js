
function LNe(e, t, r) {
	var n = "",
		i = e.tag,
		s,
		o,
		a
	for (s = 0, o = r.length; s < o; s += 1)
		(a = r[s]),
			e.replacer && (a = e.replacer.call(r, String(s), a)),
			(vd(e, t, a, !1, !1) || (typeof a > "u" && vd(e, t, null, !1, !1))) &&
				(n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), (n += e.dump))
	;(e.tag = i), (e.dump = "[" + n + "]")
}