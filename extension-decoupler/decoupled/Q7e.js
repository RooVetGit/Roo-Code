
	function q7e() {
		return this.s < 0 ? -1 : this.t <= 0 || (this.t == 1 && this.data[0] <= 0) ? 0 : 1
	}