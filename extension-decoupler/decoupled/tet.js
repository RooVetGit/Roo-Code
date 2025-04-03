
	function Tet(e, t, r, n) {
		var i = !r
		r || (r = {})
		for (var s = -1, o = t.length; ++s < o; ) {
			var a = t[s],
				l = n ? n(r[a], e[a], a, r, e) : void 0
			l === void 0 && (l = e[a]), i ? Det(r, a, l) : Bet(r, a, l)
		}
		return r
	}