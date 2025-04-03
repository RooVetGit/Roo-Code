
	function P7e() {
		if (this.s < 0) {
			if (this.t == 1) return this.data[0] - this.DV
			if (this.t == 0) return -1
		} else {
			if (this.t == 1) return this.data[0]
			if (this.t == 0) return 0
		}
		return ((this.data[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this.data[0]
	}