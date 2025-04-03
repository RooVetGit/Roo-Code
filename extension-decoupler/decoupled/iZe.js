
	function IZe(e, t, r) {
		--t
		var n = (r.t = this.t + e.t - t)
		for (r.s = 0; --n >= 0; ) r.data[n] = 0
		for (n = Math.max(t - this.t, 0); n < e.t; ++n)
			r.data[this.t + n - t] = this.am(t - n, e.data[n], r, 0, 0, this.t + n - t)
		r.clamp(), r.drShiftTo(1, r)
	}