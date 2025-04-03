
function ZQe(e, t) {
	var r = !0,
		n,
		i,
		s,
		o = e.tag,
		a,
		l = e.anchor,
		c,
		u,
		f,
		p,
		g,
		m = Object.create(null),
		y,
		C,
		v,
		b
	if (((b = e.input.charCodeAt(e.position)), b === 91)) (u = 93), (g = !1), (a = [])
	else if (b === 123) (u = 125), (g = !0), (a = {})
	else return !1
	for (e.anchor !== null && (e.anchorMap[e.anchor] = a), b = e.input.charCodeAt(++e.position); b !== 0; ) {
		if ((_i(e, !0, t), (b = e.input.charCodeAt(e.position)), b === u))
			return e.position++, (e.tag = o), (e.anchor = l), (e.kind = g ? "mapping" : "sequence"), (e.result = a), !0
		r
			? b === 44 && Xe(e, "expected the node content, but found ','")
			: Xe(e, "missed comma between flow collection entries"),
			(C = y = v = null),
			(f = p = !1),
			b === 63 && ((c = e.input.charCodeAt(e.position + 1)), Mo(c) && ((f = p = !0), e.position++, _i(e, !0, t))),
			(n = e.line),
			(i = e.lineStart),
			(s = e.position),
			mm(e, t, JI, !1, !0),
			(C = e.tag),
			(y = e.result),
			_i(e, !0, t),
			(b = e.input.charCodeAt(e.position)),
			(p || e.line === n) &&
				b === 58 &&
				((f = !0), (b = e.input.charCodeAt(++e.position)), _i(e, !0, t), mm(e, t, JI, !1, !0), (v = e.result)),
			g ? Am(e, a, m, C, y, v, n, i, s) : f ? a.push(Am(e, null, m, C, y, v, n, i, s)) : a.push(y),
			_i(e, !0, t),
			(b = e.input.charCodeAt(e.position)),
			b === 44 ? ((r = !0), (b = e.input.charCodeAt(++e.position))) : (r = !1)
	}
	Xe(e, "unexpected end of the stream within a flow collection")
}