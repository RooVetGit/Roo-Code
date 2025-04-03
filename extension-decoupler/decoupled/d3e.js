
	function D3e(e) {
		if (e[0] === "[") {
			let r = e.indexOf("]")
			return xE(r !== -1), e.substring(1, r)
		}
		let t = e.indexOf(":")
		return t === -1 ? e : e.substring(0, t)
	}