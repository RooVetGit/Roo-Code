
	function GWe(e, t) {
		if (e.length !== t.length) return !1
		for (let r = 0; r < e.length; ++r)
			if (e[r] !== t[r]) {
				if ((e[r] === "+" && t[r] === "-") || (e[r] === "/" && t[r] === "_")) continue
				return !1
			}
		return !0
	}