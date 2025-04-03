
function O0t(e, t, r, n) {
	;(n = Object.assign({ excludeFalseConflicts: !0, stringSeparator: /\s+/ }, n)),
		typeof e == "string" && (e = e.split(n.stringSeparator)),
		typeof t == "string" && (t = t.split(n.stringSeparator)),
		typeof r == "string" && (r = r.split(n.stringSeparator))
	let s = [],
		o = U0t(e, t, r),
		a = []
	function l() {
		a.length && s.push({ ok: a }), (a = [])
	}
	function c(u, f) {
		if (u.length !== f.length) return !1
		for (let p = 0; p < u.length; p++) if (u[p] !== f[p]) return !1
		return !0
	}
	return (
		o.forEach((u) => {
			u.stable
				? a.push(...u.bufferContent)
				: n.excludeFalseConflicts && c(u.aContent, u.bContent)
					? a.push(...u.aContent)
					: (l(),
						s.push({
							conflict: {
								a: u.aContent,
								aIndex: u.aStart,
								o: u.oContent,
								oIndex: u.oStart,
								b: u.bContent,
								bIndex: u.bStart,
							},
						}))
		}),
		l(),
		s
	)
}