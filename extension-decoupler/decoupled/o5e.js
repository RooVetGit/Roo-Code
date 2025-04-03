
	function O5e(e, t, r, n, i, s) {
		var o = r & P5e,
			a = BX(e),
			l = a.length,
			c = BX(t),
			u = c.length
		if (l != u && !o) return !1
		for (var f = l; f--; ) {
			var p = a[f]
			if (!(o ? p in t : U5e.call(t, p))) return !1
		}
		var g = s.get(e),
			m = s.get(t)
		if (g && m) return g == t && m == e
		var y = !0
		s.set(e, t), s.set(t, e)
		for (var C = o; ++f < l; ) {
			p = a[f]
			var v = e[p],
				b = t[p]
			if (n) var w = o ? n(b, v, p, t, e, s) : n(v, b, p, e, t, s)
			if (!(w === void 0 ? v === b || i(v, b, r, n, s) : w)) {
				y = !1
				break
			}
			C || (C = p == "constructor")
		}
		if (y && !C) {
			var B = e.constructor,
				M = t.constructor
			B != M &&
				"constructor" in e &&
				"constructor" in t &&
				!(typeof B == "function" && B instanceof B && typeof M == "function" && M instanceof M) &&
				(y = !1)
		}
		return s.delete(e), s.delete(t), y
	}