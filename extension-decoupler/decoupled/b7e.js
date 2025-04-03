
	function B7e(e) {
		var t = Br()
		return (
			e.abs().dlShiftTo(this.m.t, t),
			t.divRemTo(this.m, null, t),
			e.s < 0 && t.compareTo(ge.ZERO) > 0 && this.m.subTo(t, t),
			t
		)
	}