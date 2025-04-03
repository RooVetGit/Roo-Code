
	function L9e(e, { path: t, method: r, body: n, headers: i }) {
		let s = kd(e.path, t),
			o = kd(e.method, r),
			a = typeof e.body < "u" ? kd(e.body, n) : !0,
			l = fie(e, i)
		return s && o && a && l
	}