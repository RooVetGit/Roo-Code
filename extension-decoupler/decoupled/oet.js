
	function Oet(e) {
		if (!Qet(e)) return Pet(e)
		var t = Net(e),
			r = []
		for (var n in e) (n == "constructor" && (t || !Uet.call(e, n))) || r.push(n)
		return r
	}