
	function LZe(e) {
		var t = this.subtract(ge.ONE),
			r = t.getLowestSetBit()
		if (r <= 0) return !1
		for (var n = t.shiftRight(r), i = UZe(), s, o = 0; o < e; ++o) {
			do s = new ge(this.bitLength(), i)
			while (s.compareTo(ge.ONE) <= 0 || s.compareTo(t) >= 0)
			var a = s.modPow(n, this)
			if (a.compareTo(ge.ONE) != 0 && a.compareTo(t) != 0) {
				for (var l = 1; l++ < r && a.compareTo(t) != 0; )
					if (((a = a.modPowInt(2, this)), a.compareTo(ge.ONE) == 0)) return !1
				if (a.compareTo(t) != 0) return !1
			}
		}
		return !0
	}