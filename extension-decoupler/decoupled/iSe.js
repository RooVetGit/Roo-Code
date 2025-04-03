
	function ise(e) {
		let t = 0,
			r = e.length
		for (; r > t && rse(e.charCodeAt(r - 1)); ) --r
		for (; r > t && rse(e.charCodeAt(t)); ) ++t
		return t === 0 && r === e.length ? e : e.substring(t, r)
	}