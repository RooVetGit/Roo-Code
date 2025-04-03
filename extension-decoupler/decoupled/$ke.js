
	function $Ke(e) {
		for (let t = 0; t < e.length; ++t) {
			let r = e.charCodeAt(t)
			if ((r >= 0 && r <= 8) || (r >= 10 && r <= 31) || r === 127) return !0
		}
		return !1
	}