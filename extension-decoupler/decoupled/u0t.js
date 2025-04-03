
function U0t(e, t, r) {
	let n = []
	function i(l, c) {
		n.push({
			ab: c,
			oStart: l.buffer1[0],
			oLength: l.buffer1[1],
			abStart: l.buffer2[0],
			abLength: l.buffer2[1],
		})
	}
	Exe(t, e).forEach((l) => i(l, "a")), Exe(t, r).forEach((l) => i(l, "b")), n.sort((l, c) => l.oStart - c.oStart)
	let s = [],
		o = 0
	function a(l) {
		l > o &&
			(s.push({
				stable: !0,
				buffer: "o",
				bufferStart: o,
				bufferLength: l - o,
				bufferContent: t.slice(o, l),
			}),
			(o = l))
	}
	for (; n.length; ) {
		let l = n.shift(),
			c = l.oStart,
			u = l.oStart + l.oLength,
			f = [l]
		for (a(c); n.length; ) {
			let p = n[0],
				g = p.oStart
			if (g > u) break
			;(u = Math.max(u, g + p.oLength)), f.push(n.shift())
		}
		if (f.length === 1) {
			if (l.abLength > 0) {
				let p = l.ab === "a" ? e : r
				s.push({
					stable: !0,
					buffer: l.ab,
					bufferStart: l.abStart,
					bufferLength: l.abLength,
					bufferContent: p.slice(l.abStart, l.abStart + l.abLength),
				})
			}
		} else {
			let p = {
				a: [e.length, -1, t.length, -1],
				b: [r.length, -1, t.length, -1],
			}
			for (; f.length; ) {
				l = f.shift()
				let b = l.oStart,
					w = b + l.oLength,
					B = l.abStart,
					M = B + l.abLength,
					Q = p[l.ab]
				;(Q[0] = Math.min(B, Q[0])),
					(Q[1] = Math.max(M, Q[1])),
					(Q[2] = Math.min(b, Q[2])),
					(Q[3] = Math.max(w, Q[3]))
			}
			let g = p.a[0] + (c - p.a[2]),
				m = p.a[1] + (u - p.a[3]),
				y = p.b[0] + (c - p.b[2]),
				C = p.b[1] + (u - p.b[3]),
				v = {
					stable: !1,
					aStart: g,
					aLength: m - g,
					aContent: e.slice(g, m),
					oStart: c,
					oLength: u - c,
					oContent: t.slice(c, u),
					bStart: y,
					bLength: C - y,
					bContent: r.slice(y, C),
				}
			s.push(v)
		}
		o = u
	}
	return a(t.length), s
}