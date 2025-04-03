
	function jKe(e) {
		if (e.name.length === 0) return null
		Soe(e.name), Boe(e.value)
		let t = [`${e.name}=${e.value}`]
		e.name.startsWith("__Secure-") && (e.secure = !0),
			e.name.startsWith("__Host-") && ((e.secure = !0), (e.domain = null), (e.path = "/")),
			e.secure && t.push("Secure"),
			e.httpOnly && t.push("HttpOnly"),
			typeof e.maxAge == "number" && (zKe(e.maxAge), t.push(`Max-Age=${e.maxAge}`)),
			e.domain && (YKe(e.domain), t.push(`Domain=${e.domain}`)),
			e.path && (Doe(e.path), t.push(`Path=${e.path}`)),
			e.expires && e.expires.toString() !== "Invalid Date" && t.push(`Expires=${Toe(e.expires)}`),
			e.sameSite && t.push(`SameSite=${e.sameSite}`)
		for (let r of e.unparsed) {
			if (!r.includes("=")) throw new Error("Invalid unparsed")
			let [n, ...i] = r.split("=")
			t.push(`${n.trim()}=${i.join("=")}`)
		}
		return t.join("; ")
	}