
	function fie(e, t) {
		if (typeof e.headers == "function") return Array.isArray(t) && (t = tV(t)), e.headers(t ? uie(t) : {})
		if (typeof e.headers > "u") return !0
		if (typeof t != "object" || typeof e.headers != "object") return !1
		for (let [r, n] of Object.entries(e.headers)) {
			let i = die(t, r)
			if (!kd(n, i)) return !1
		}
		return !0
	}