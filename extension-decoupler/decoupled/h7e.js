
	function H7e(e, t) {
		this.fromInt(0), t == null && (t = 10)
		for (var r = this.chunkSize(t), n = Math.pow(t, r), i = !1, s = 0, o = 0, a = 0; a < e.length; ++a) {
			var l = Fle(e, a)
			if (l < 0) {
				e.charAt(a) == "-" && this.signum() == 0 && (i = !0)
				continue
			}
			;(o = t * o + l), ++s >= r && (this.dMultiply(n), this.dAddOffset(o, 0), (s = 0), (o = 0))
		}
		s > 0 && (this.dMultiply(Math.pow(t, s)), this.dAddOffset(o, 0)), i && ge.ZERO.subTo(this, this)
	}