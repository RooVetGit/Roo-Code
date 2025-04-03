
	function A7e(e, t) {
		t.s = this.s
		var r = Math.floor(e / this.DB)
		if (r >= this.t) {
			t.t = 0
			return
		}
		var n = e % this.DB,
			i = this.DB - n,
			s = (1 << n) - 1
		t.data[0] = this.data[r] >> n
		for (var o = r + 1; o < this.t; ++o)
			(t.data[o - r - 1] |= (this.data[o] & s) << i), (t.data[o - r] = this.data[o] >> n)
		n > 0 && (t.data[this.t - r - 1] |= (this.s & s) << i), (t.t = this.t - r), t.clamp()
	}