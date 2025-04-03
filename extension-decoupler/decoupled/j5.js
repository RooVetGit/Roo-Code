
	function j5(e) {
		var t,
			r,
			n = 1
		for (t = 0; t < 16; ++t) (r = e[t] + n + 65535), (n = Math.floor(r / 65536)), (e[t] = r - n * 65536)
		e[0] += n - 1 + 37 * (n - 1)
	}