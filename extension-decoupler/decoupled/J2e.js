
	function j2e(e) {
		if (G2e.test(e) || Y2e.test(e)) return !0
		if (!bJ.test(e) || !J2e.test(e)) return !1
		var t = e.match(xJ),
			r = e.match(_J)
		return r !== null && 2 * r.length === t.length
	}