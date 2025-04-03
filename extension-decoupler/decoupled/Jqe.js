
function jQe(e, t) {
	var r, n, i, s, o, a
	if (((a = e.input.charCodeAt(e.position)), a !== 34)) return !1
	for (
		e.kind = "scalar", e.result = "", e.position++, r = n = e.position;
		(a = e.input.charCodeAt(e.position)) !== 0;

	) {
		if (a === 34) return Qf(e, r, e.position, !0), e.position++, !0
		if (a === 92) {
			if ((Qf(e, r, e.position, !0), (a = e.input.charCodeAt(++e.position)), zc(a))) _i(e, !1, t)
			else if (a < 256 && fK[a]) (e.result += hK[a]), e.position++
			else if ((o = GQe(a)) > 0) {
				for (i = o, s = 0; i > 0; i--)
					(a = e.input.charCodeAt(++e.position)),
						(o = WQe(a)) >= 0 ? (s = (s << 4) + o) : Xe(e, "expected hexadecimal character")
				;(e.result += YQe(s)), e.position++
			} else Xe(e, "unknown escape sequence")
			r = n = e.position
		} else
			zc(a)
				? (Qf(e, r, n, !0), UP(e, _i(e, !1, t)), (r = n = e.position))
				: e.position === e.lineStart && eS(e)
					? Xe(e, "unexpected end of the document within a double quoted scalar")
					: (e.position++, (n = e.position))
	}
	Xe(e, "unexpected end of the stream within a double quoted scalar")
}