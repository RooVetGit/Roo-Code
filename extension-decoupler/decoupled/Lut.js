
function Lut(
	e,
	t,
	r,
	{
		location: n = Dt.location,
		distance: i = Dt.distance,
		threshold: s = Dt.threshold,
		findAllMatches: o = Dt.findAllMatches,
		minMatchCharLength: a = Dt.minMatchCharLength,
		includeMatches: l = Dt.includeMatches,
		ignoreLocation: c = Dt.ignoreLocation,
	} = {},
) {
	if (t.length > zp) throw new Error(Iut(zp))
	let u = t.length,
		f = e.length,
		p = Math.max(0, Math.min(n, f)),
		g = s,
		m = p,
		y = a > 1 || l,
		C = y ? Array(f) : [],
		v
	for (; (v = e.indexOf(t, m)) > -1; ) {
		let O = bk(t, {
			currentLocation: v,
			expectedLocation: p,
			distance: i,
			ignoreLocation: c,
		})
		if (((g = Math.min(O, g)), (m = v + u), y)) {
			let Y = 0
			for (; Y < u; ) (C[v + Y] = 1), (Y += 1)
		}
	}
	m = -1
	let b = [],
		w = 1,
		B = u + f,
		M = 1 << (u - 1)
	for (let O = 0; O < u; O += 1) {
		let Y = 0,
			j = B
		for (; Y < j; )
			bk(t, {
				errors: O,
				currentLocation: p + j,
				expectedLocation: p,
				distance: i,
				ignoreLocation: c,
			}) <= g
				? (Y = j)
				: (B = j),
				(j = Math.floor((B - Y) / 2 + Y))
		B = j
		let ne = Math.max(1, p - j + 1),
			q = o ? f : Math.min(p + j, f) + u,
			me = Array(q + 2)
		me[q + 1] = (1 << O) - 1
		for (let N = q; N >= ne; N -= 1) {
			let re = N - 1,
				K = r[e.charAt(re)]
			if (
				(y && (C[re] = +!!K),
				(me[N] = ((me[N + 1] << 1) | 1) & K),
				O && (me[N] |= ((b[N + 1] | b[N]) << 1) | 1 | b[N + 1]),
				me[N] & M &&
					((w = bk(t, {
						errors: O,
						currentLocation: re,
						expectedLocation: p,
						distance: i,
						ignoreLocation: c,
					})),
					w <= g))
			) {
				if (((g = w), (m = re), m <= p)) break
				ne = Math.max(1, 2 * p - m)
			}
		}
		if (
			bk(t, {
				errors: O + 1,
				currentLocation: p,
				expectedLocation: p,
				distance: i,
				ignoreLocation: c,
			}) > g
		)
			break
		b = me
	}
	let Q = { isMatch: m >= 0, score: Math.max(0.001, w) }
	if (y) {
		let O = Put(C, a)
		O.length ? l && (Q.indices = O) : (Q.isMatch = !1)
	}
	return Q
}