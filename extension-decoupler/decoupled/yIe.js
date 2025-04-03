
	function yie(e, t) {
		let r = new URL(t)
		return e === !0 ? !0 : !!(Array.isArray(e) && e.some((n) => kd(n, r.host)))
	}