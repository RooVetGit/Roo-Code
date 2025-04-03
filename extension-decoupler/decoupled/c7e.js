
	function C7e(e) {
		for (var t = this.abs(), r = (e.t = 2 * t.t); --r >= 0; ) e.data[r] = 0
		for (r = 0; r < t.t - 1; ++r) {
			var n = t.am(r, t.data[r], e, 2 * r, 0, 1)
			;(e.data[r + t.t] += t.am(r + 1, 2 * t.data[r], e, 2 * r + 1, n, t.t - r - 1)) >= t.DV &&
				((e.data[r + t.t] -= t.DV), (e.data[r + t.t + 1] = 1))
		}
		e.t > 0 && (e.data[e.t - 1] += t.am(r, t.data[r], e, 2 * r, 0, 1)), (e.s = 0), e.clamp()
	}