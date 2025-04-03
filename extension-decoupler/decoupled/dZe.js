
	function DZe(e) {
		for (
			e.drShiftTo(this.m.t - 1, this.r2),
				e.t > this.m.t + 1 && ((e.t = this.m.t + 1), e.clamp()),
				this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3),
				this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
			e.compareTo(this.r2) < 0;

		)
			e.dAddOffset(1, this.m.t + 1)
		for (e.subTo(this.r2, e); e.compareTo(this.m) >= 0; ) e.subTo(this.m, e)
	}