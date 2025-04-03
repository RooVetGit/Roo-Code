
	function Kle(e) {
		for (var t = rt.util.hexToBytes(e.toString(16)), r = new Uint8Array(t.length), n = 0; n < t.length; ++n)
			r[n] = t.charCodeAt(n)
		return r
	}