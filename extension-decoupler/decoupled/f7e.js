
	function F7e(e, t) {
		if (e > 4294967295 || e < 1) return ge.ONE
		var r = Br(),
			n = Br(),
			i = t.convert(this),
			s = AT(e) - 1
		for (i.copyTo(r); --s >= 0; )
			if ((t.sqrTo(r, n), (e & (1 << s)) > 0)) t.mulTo(n, i, r)
			else {
				var o = r
				;(r = n), (n = o)
			}
		return t.revert(r)
	}