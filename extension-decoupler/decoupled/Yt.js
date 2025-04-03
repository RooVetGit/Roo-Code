
	function yT(e, t, r, n) {
		var i = Math.ceil(t.n.bitLength() / 8),
			s = rt.util.createBuffer(e),
			o = s.getByte(),
			a = s.getByte()
		if (o !== 0 || (r && a !== 0 && a !== 1) || (!r && a != 2) || (r && a === 0 && typeof n > "u"))
			throw new Error("Encryption block is invalid.")
		var l = 0
		if (a === 0) {
			l = i - 3 - n
			for (var c = 0; c < l; ++c) if (s.getByte() !== 0) throw new Error("Encryption block is invalid.")
		} else if (a === 1)
			for (l = 0; s.length() > 1; ) {
				if (s.getByte() !== 255) {
					--s.read
					break
				}
				++l
			}
		else if (a === 2)
			for (l = 0; s.length() > 1; ) {
				if (s.getByte() === 0) {
					--s.read
					break
				}
				++l
			}
		var u = s.getByte()
		if (u !== 0 || l !== i - 3 - s.length()) throw new Error("Encryption block is invalid.")
		return s.getBytes()
	}