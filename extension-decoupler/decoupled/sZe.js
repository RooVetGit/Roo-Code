
	function SZe(e) {
		if (e.s < 0 || e.t > 2 * this.m.t) return e.mod(this.m)
		if (e.compareTo(this.m) < 0) return e
		var t = Br()
		return e.copyTo(t), this.reduce(t), t
	}