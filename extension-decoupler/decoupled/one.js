
function ONe(e, t, r, n) {
	var i = "",
		s = e.tag,
		o = Object.keys(r),
		a,
		l,
		c,
		u,
		f,
		p
	if (e.sortKeys === !0) o.sort()
	else if (typeof e.sortKeys == "function") o.sort(e.sortKeys)
	else if (e.sortKeys) throw new ko("sortKeys must be a boolean or a function")
	for (a = 0, l = o.length; a < l; a += 1)
		(p = ""),
			(!n || i !== "") && (p += FP(e, t)),
			(c = o[a]),
			(u = r[c]),
			e.replacer && (u = e.replacer.call(r, c, u)),
			vd(e, t + 1, c, !0, !0, !0) &&
				((f = (e.tag !== null && e.tag !== "?") || (e.dump && e.dump.length > 1024)),
				f && (e.dump && Wv === e.dump.charCodeAt(0) ? (p += "?") : (p += "? ")),
				(p += e.dump),
				f && (p += FP(e, t)),
				vd(e, t + 1, u, !0, f) &&
					(e.dump && Wv === e.dump.charCodeAt(0) ? (p += ":") : (p += ": "), (p += e.dump), (i += p)))
	;(e.tag = s), (e.dump = i || "{}")
}