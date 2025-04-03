
	function PZe(e) {
		var t,
			r = this.abs()
		if (r.t == 1 && r.data[0] <= pc[pc.length - 1]) {
			for (t = 0; t < pc.length; ++t) if (r.data[0] == pc[t]) return !0
			return !1
		}
		if (r.isEven()) return !1
		for (t = 1; t < pc.length; ) {
			for (var n = pc[t], i = t + 1; i < pc.length && n < NZe; ) n *= pc[i++]
			for (n = r.modInt(n); t < i; ) if (n % pc[t++] == 0) return !1
		}
		return r.millerRabin(e)
	}