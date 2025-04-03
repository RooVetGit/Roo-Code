
	function D0(e, t = {}) {
		if (e.length === 0) return t
		tJe(e[0] === ";"), (e = e.slice(1))
		let r = ""
		e.includes(";") ? ((r = UD(";", e, { position: 0 })), (e = e.slice(r.length))) : ((r = e), (e = ""))
		let n = "",
			i = ""
		if (r.includes("=")) {
			let o = { position: 0 }
			;(n = UD("=", r, o)), (i = r.slice(o.position + 1))
		} else n = r
		if (((n = n.trim()), (i = i.trim()), i.length > XKe)) return D0(e, t)
		let s = n.toLowerCase()
		if (s === "expires") {
			let o = new Date(i)
			t.expires = o
		} else if (s === "max-age") {
			let o = i.charCodeAt(0)
			if (((o < 48 || o > 57) && i[0] !== "-") || !/^\d+$/.test(i)) return D0(e, t)
			let a = Number(i)
			t.maxAge = a
		} else if (s === "domain") {
			let o = i
			o[0] === "." && (o = o.slice(1)), (o = o.toLowerCase()), (t.domain = o)
		} else if (s === "path") {
			let o = ""
			i.length === 0 || i[0] !== "/" ? (o = "/") : (o = i), (t.path = o)
		} else if (s === "secure") t.secure = !0
		else if (s === "httponly") t.httpOnly = !0
		else if (s === "samesite") {
			let o = "Default",
				a = i.toLowerCase()
			a.includes("none") && (o = "None"),
				a.includes("strict") && (o = "Strict"),
				a.includes("lax") && (o = "Lax"),
				(t.sameSite = o)
		} else (t.unparsed ??= []), t.unparsed.push(`${n}=${i}`)
		return D0(e, t)
	}