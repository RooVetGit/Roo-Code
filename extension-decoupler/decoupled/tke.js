
	function TKe(e, t) {
		let r = coe(e),
			n = RKe(r),
			i = 0
		n !== null && ((t = n), (i = n === "UTF-8" ? 3 : 2))
		let s = r.slice(i)
		return new TextDecoder(t).decode(s)
	}