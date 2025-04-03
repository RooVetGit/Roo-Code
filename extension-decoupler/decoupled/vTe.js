
	function vte(e) {
		for (let t = 0; t < e.length; ++t) {
			let r = e.charCodeAt(t)
			if (r > 126 || r < 32) return !1
		}
		return !0
	}