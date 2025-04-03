
	function qnt(e) {
		let t = new Set()
		for (let r of e) (typeof r == "string" || typeof r == "number") && t.add(String(r))
		return t
	}