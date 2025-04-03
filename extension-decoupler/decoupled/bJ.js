
	function bj(e, t) {
		for (var r = 0, n = e.length; r < n; r++) {
			var i = e[r][0],
				s = e[r][1]
			t.hasAttribute(i) || t._setAttribute(i, s)
		}
	}