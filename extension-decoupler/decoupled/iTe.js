
	function Ite(e) {
		ip("protocol" in e)
		let t = e.protocol
		return t === "http:" || t === "https:"
	}