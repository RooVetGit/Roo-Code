
	function NR(e) {
		var t = Math.round(e).toString(16).toUpperCase()
		return t.length < 2 ? "0" + t : t
	}