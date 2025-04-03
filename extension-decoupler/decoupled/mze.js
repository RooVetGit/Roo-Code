
	function MZe(e) {
		var t = this.s < 0 ? this.negate() : this.clone(),
			r = e.s < 0 ? e.negate() : e.clone()
		if (t.compareTo(r) < 0) {
			var n = t
			;(t = r), (r = n)
		}
		var i = t.getLowestSetBit(),
			s = r.getLowestSetBit()
		if (s < 0) return t
		for (i < s && (s = i), s > 0 && (t.rShiftTo(s, t), r.rShiftTo(s, r)); t.signum() > 0; )
			(i = t.getLowestSetBit()) > 0 && t.rShiftTo(i, t),
				(i = r.getLowestSetBit()) > 0 && r.rShiftTo(i, r),
				t.compareTo(r) >= 0 ? (t.subTo(r, t), t.rShiftTo(1, t)) : (r.subTo(t, r), r.rShiftTo(1, r))
		return s > 0 && r.lShiftTo(s, r), r
	}