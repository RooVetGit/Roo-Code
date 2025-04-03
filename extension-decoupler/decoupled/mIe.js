
	function mie(e, t) {
		let r = pie(e),
			n = gie(this[nD], r)
		n.timesInvoked++, n.data.callback && (n.data = { ...n.data, ...n.data.callback(e) })
		let {
				data: { statusCode: i, data: s, headers: o, trailers: a, error: l },
				delay: c,
				persist: u,
			} = n,
			{ timesInvoked: f, times: p } = n
		if (((n.consumed = !u && f >= p), (n.pending = f < p), l !== null)) return Xq(this[nD], r), t.onError(l), !0
		typeof c == "number" && c > 0
			? setTimeout(() => {
					g(this[nD])
				}, c)
			: g(this[nD])
		function g(y, C = s) {
			let v = Array.isArray(e.headers) ? tV(e.headers) : e.headers,
				b = typeof C == "function" ? C({ ...e, headers: v }) : C
			if (P9e(b)) {
				b.then((Q) => g(y, Q))
				return
			}
			let w = hie(b),
				B = eV(o),
				M = eV(a)
			t.onConnect?.((Q) => t.onError(Q), null),
				t.onHeaders?.(i, B, m, Aie(i)),
				t.onData?.(Buffer.from(w)),
				t.onComplete?.(M),
				Xq(y, r)
		}
		function m() {}
		return !0
	}