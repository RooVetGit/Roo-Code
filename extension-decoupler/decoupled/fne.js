
function FNe(e, t, r, n, i, s, o, a) {
	var l,
		c = 0,
		u = null,
		f = !1,
		p = !1,
		g = n !== -1,
		m = -1,
		y = kNe(Vv(e, 0)) && MNe(Vv(e, e.length - 1))
	if (t || o)
		for (l = 0; l < e.length; c >= 65536 ? (l += 2) : l++) {
			if (((c = Vv(e, l)), !$v(c))) return gm
			;(y = y && jY(c, u, a)), (u = c)
		}
	else {
		for (l = 0; l < e.length; c >= 65536 ? (l += 2) : l++) {
			if (((c = Vv(e, l)), c === Wv)) (f = !0), g && ((p = p || (l - m - 1 > n && e[m + 1] !== " ")), (m = l))
			else if (!$v(c)) return gm
			;(y = y && jY(c, u, a)), (u = c)
		}
		p = p || (g && l - m - 1 > n && e[m + 1] !== " ")
	}
	return !f && !p
		? y && !o && !i(e)
			? wK
			: s === Gv
				? gm
				: QP
		: r > 9 && _K(e)
			? gm
			: o
				? s === Gv
					? gm
					: QP
				: p
					? SK
					: IK
}