
	function Rit(e, t, r) {
		return (
			(t = xhe(t)),
			t in e
				? Object.defineProperty(e, t, {
						value: r,
						enumerable: !0,
						configurable: !0,
						writable: !0,
					})
				: (e[t] = r),
			e
		)
	}