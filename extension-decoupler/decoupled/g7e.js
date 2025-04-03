
	function G7e() {
		var e = this.t,
			t = new Array()
		t[0] = this.s
		var r = this.DB - ((e * this.DB) % 8),
			n,
			i = 0
		if (e-- > 0)
			for (
				r < this.DB &&
				(n = this.data[e] >> r) != (this.s & this.DM) >> r &&
				(t[i++] = n | (this.s << (this.DB - r)));
				e >= 0;

			)
				r < 8
					? ((n = (this.data[e] & ((1 << r) - 1)) << (8 - r)), (n |= this.data[--e] >> (r += this.DB - 8)))
					: ((n = (this.data[e] >> (r -= 8)) & 255), r <= 0 && ((r += this.DB), --e)),
					n & 128 && (n |= -256),
					i == 0 && (this.s & 128) != (n & 128) && ++i,
					(i > 0 || n != this.s) && (t[i++] = n)
		return t
	}