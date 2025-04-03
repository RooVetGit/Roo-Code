
	function FZe(e) {
		if (e <= 0) return 0
		var t = this.DV % e,
			r = this.s < 0 ? e - 1 : 0
		if (this.t > 0)
			if (t == 0) r = this.data[0] % e
			else for (var n = this.t - 1; n >= 0; --n) r = (t * r + this.data[n]) % e
		return r
	}