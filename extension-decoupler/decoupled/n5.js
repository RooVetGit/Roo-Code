
	function N5(e) {
		if (e.composed || e.constructed) {
			for (var t = gn.util.createBuffer(), r = 0; r < e.value.length; ++r) t.putBytes(e.value[r].value)
			;(e.composed = e.constructed = !1), (e.value = t.getBytes())
		}
		return e
	}