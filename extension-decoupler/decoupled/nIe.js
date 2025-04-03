
	function nie(e, t) {
		if (t === void 0)
			return new Promise((r, n) => {
				nie.call(this, e, (i, s) => (i ? n(i) : r(s)))
			})
		try {
			let r = new zq(e, t)
			this.dispatch({ ...e, method: "CONNECT" }, r)
		} catch (r) {
			if (typeof t != "function") throw r
			let n = e?.opaque
			queueMicrotask(() => t(r, { opaque: n }))
		}
	}