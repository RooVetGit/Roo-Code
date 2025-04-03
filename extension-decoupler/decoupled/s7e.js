
	function S7e() {
		if (this.t < 1) return 0
		var e = this.data[0]
		if (!(e & 1)) return 0
		var t = e & 3
		return (
			(t = (t * (2 - (e & 15) * t)) & 15),
			(t = (t * (2 - (e & 255) * t)) & 255),
			(t = (t * (2 - (((e & 65535) * t) & 65535))) & 65535),
			(t = (t * (2 - ((e * t) % this.DV))) % this.DV),
			t > 0 ? this.DV - t : -t
		)
	}