
	function JAe(e) {
		if (typeof e == "number") return e
		if (iut(e)) return KAe
		if (pk(e)) {
			var t = typeof e.valueOf == "function" ? e.valueOf() : e
			e = pk(t) ? t + "" : t
		}
		if (typeof e != "string") return e === 0 ? e : +e
		e = e.replace(Hct, "")
		var r = Gct.test(e)
		return r || $ct.test(e) ? Yct(e.slice(2), r ? 2 : 8) : Wct.test(e) ? KAe : +e
	}