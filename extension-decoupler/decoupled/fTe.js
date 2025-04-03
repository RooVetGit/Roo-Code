
	function fte(e) {
		let t = e.length
		if (65535 > t) return String.fromCharCode.apply(null, e)
		let r = "",
			n = 0,
			i = 65535
		for (; n < t; ) n + i > t && (i = t - n), (r += String.fromCharCode.apply(null, e.subarray(n, (n += i))))
		return r
	}