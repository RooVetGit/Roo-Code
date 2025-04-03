
	function V7e(e) {
		if ((e == null && (e = 10), this.signum() == 0 || e < 2 || e > 36)) return "0"
		var t = this.chunkSize(e),
			r = Math.pow(e, t),
			n = fh(r),
			i = Br(),
			s = Br(),
			o = ""
		for (this.divRemTo(n, i, s); i.signum() > 0; )
			(o = (r + s.intValue()).toString(e).substr(1) + o), i.divRemTo(n, i, s)
		return s.intValue().toString(e) + o
	}