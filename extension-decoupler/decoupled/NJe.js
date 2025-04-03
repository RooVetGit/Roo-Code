
	var Nje = function (e, t) {
		var r = e.getByte()
		if ((t--, r !== 128)) {
			var n,
				i = r & 128
			if (!i) n = r
			else {
				var s = r & 127
				Ib(e, t, s), (n = e.getInt(s << 3))
			}
			if (n < 0) throw new Error("Negative length: " + n)
			return n
		}
	}