
	function k6e(e) {
		if (Array.isArray(e)) {
			let t = {}
			for (let r = 0; r < e.length; r += 2) t[e[r]] = e[r + 1]
			return t
		}
		return e
	}