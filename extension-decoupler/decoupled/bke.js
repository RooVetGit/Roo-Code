
	function BKe(e, t, r, n) {
		if (e[I0] === "loading") throw new DOMException("Invalid state", "InvalidStateError")
		;(e[I0] = "loading"), (e[ioe] = null), (e[qV] = null)
		let s = t.stream().getReader(),
			o = [],
			a = s.read(),
			l = !0
		;(async () => {
			for (; !e[ub]; )
				try {
					let { done: c, value: u } = await a
					if (
						(l &&
							!e[ub] &&
							queueMicrotask(() => {
								ih("loadstart", e)
							}),
						(l = !1),
						!c && IKe.isUint8Array(u))
					)
						o.push(u),
							(e[VV] === void 0 || Date.now() - e[VV] >= 50) &&
								!e[ub] &&
								((e[VV] = Date.now()),
								queueMicrotask(() => {
									ih("progress", e)
								})),
							(a = s.read())
					else if (c) {
						queueMicrotask(() => {
							e[I0] = "done"
							try {
								let f = DKe(o, r, t.type, n)
								if (e[ub]) return
								;(e[ioe] = f), ih("load", e)
							} catch (f) {
								;(e[qV] = f), ih("error", e)
							}
							e[I0] !== "loading" && ih("loadend", e)
						})
						break
					}
				} catch (c) {
					if (e[ub]) return
					queueMicrotask(() => {
						;(e[I0] = "done"), (e[qV] = c), ih("error", e), e[I0] !== "loading" && ih("loadend", e)
					})
					break
				}
		})()
	}