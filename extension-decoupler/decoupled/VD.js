
function vd(e, t, r, n, i, s, o) {
	;(e.tag = null), (e.dump = r), rK(e, r, !1) || rK(e, r, !0)
	var a = mK.call(e.dump),
		l = n,
		c
	n && (n = e.flowLevel < 0 || e.flowLevel > t)
	var u = a === "[object Object]" || a === "[object Array]",
		f,
		p
	if (
		(u && ((f = e.duplicates.indexOf(r)), (p = f !== -1)),
		((e.tag !== null && e.tag !== "?") || p || (e.indent !== 2 && t > 0)) && (i = !1),
		p && e.usedDuplicates[f])
	)
		e.dump = "*ref_" + f
	else {
		if ((u && p && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), a === "[object Object]"))
			n && Object.keys(e.dump).length !== 0
				? (ONe(e, t, e.dump, i), p && (e.dump = "&ref_" + f + e.dump))
				: (UNe(e, t, e.dump), p && (e.dump = "&ref_" + f + " " + e.dump))
		else if (a === "[object Array]")
			n && e.dump.length !== 0
				? (e.noArrayIndent && !o && t > 0 ? tK(e, t - 1, e.dump, i) : tK(e, t, e.dump, i),
					p && (e.dump = "&ref_" + f + e.dump))
				: (LNe(e, t, e.dump), p && (e.dump = "&ref_" + f + " " + e.dump))
		else if (a === "[object String]") e.tag !== "?" && QNe(e, e.dump, t, s, l)
		else {
			if (a === "[object Undefined]") return !1
			if (e.skipInvalid) return !1
			throw new ko("unacceptable kind of an object to dump " + a)
		}
		e.tag !== null &&
			e.tag !== "?" &&
			((c = encodeURI(e.tag[0] === "!" ? e.tag.slice(1) : e.tag).replace(/!/g, "%21")),
			e.tag[0] === "!"
				? (c = "!" + c)
				: c.slice(0, 18) === "tag:yaml.org,2002:"
					? (c = "!!" + c.slice(18))
					: (c = "!<" + c + ">"),
			(e.dump = c + " " + e.dump))
	}
	return !0
}