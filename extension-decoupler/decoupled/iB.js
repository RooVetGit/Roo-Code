
	function Ib(e, t, r) {
		if (r > t) {
			var n = new Error("Too few bytes to parse DER.")
			throw ((n.available = e.length()), (n.remaining = t), (n.requested = r), n)
		}
	}