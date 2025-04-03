
	function D4e(e) {
		let t = e.length
		if (t < 27 || t > 70) return !1
		for (let r = 0; r < t; ++r) {
			let n = e.charCodeAt(r)
			if (
				!(
					(n >= 48 && n <= 57) ||
					(n >= 65 && n <= 90) ||
					(n >= 97 && n <= 122) ||
					n === 39 ||
					n === 45 ||
					n === 95
				)
			)
				return !1
		}
		return !0
	}