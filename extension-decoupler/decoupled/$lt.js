
	function $lt(e, t, r) {
		r = (0, Ult.default)(r)
		var n = 0,
			i = 0,
			{ length: s } = e,
			o = !1
		s === 0 && r(null)
		function a(l, c) {
			l === !1 && (o = !0), o !== !0 && (l ? r(l) : (++i === s || c === Qlt.default) && r(null))
		}
		for (; n < s; n++) t(e[n], n, (0, qlt.default)(a))
	}