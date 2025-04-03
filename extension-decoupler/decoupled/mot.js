
	function Mot(e, t) {
		if ((t || (t = e.length), !t)) throw new Error("arity is undefined")
		function r(...n) {
			return typeof n[t - 1] == "function"
				? e.apply(this, n)
				: new Promise((i, s) => {
						;(n[t - 1] = (o, ...a) => {
							if (o) return s(o)
							i(a.length > 1 ? a : a[0])
						}),
							e.apply(this, n)
					})
		}
		return r
	}