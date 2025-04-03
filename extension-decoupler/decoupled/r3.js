
	function R3(e) {
		if (e.length > 200) return e.sort()
		for (let t = 1; t < e.length; t++) {
			let r = e[t],
				n = t
			for (; n !== 0 && e[n - 1] > r; ) (e[n] = e[n - 1]), n--
			e[n] = r
		}
		return e
	}