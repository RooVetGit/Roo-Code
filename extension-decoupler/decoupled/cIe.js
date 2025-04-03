
	function cie(e) {
		if (typeof e != "string") return e
		let t = e.split("?")
		if (t.length !== 2) return e
		let r = new URLSearchParams(t.pop())
		return r.sort(), [...t, r.toString()].join("?")
	}