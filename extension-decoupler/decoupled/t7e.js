
	function T7e(e) {
		for (; e.t <= this.mt2; ) e.data[e.t++] = 0
		for (var t = 0; t < this.m.t; ++t) {
			var r = e.data[t] & 32767,
				n = (r * this.mpl + (((r * this.mph + (e.data[t] >> 15) * this.mpl) & this.um) << 15)) & e.DM
			for (r = t + this.m.t, e.data[r] += this.m.am(0, n, e, t, 0, this.m.t); e.data[r] >= e.DV; )
				(e.data[r] -= e.DV), e.data[++r]++
		}
		e.clamp(), e.drShiftTo(this.m.t, e), e.compareTo(this.m) >= 0 && e.subTo(this.m, e)
	}