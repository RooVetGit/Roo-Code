
	function Boe(e) {
		let t = e.length,
			r = 0
		if (e[0] === '"') {
			if (t === 1 || e[t - 1] !== '"') throw new Error("Invalid cookie value")
			--t, ++r
		}
		for (; r < t; ) {
			let n = e.charCodeAt(r++)
			if (n < 33 || n > 126 || n === 34 || n === 44 || n === 59 || n === 92)
				throw new Error("Invalid cookie value")
		}
	}