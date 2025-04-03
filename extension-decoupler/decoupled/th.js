
	function TH(e, t) {
		var r = Object.prototype.hasOwnProperty
		for (var n in t) r.call(t, n) && (e[n] = t[n])
		return e
	}