
	function Are(e, t, r) {
		if (e.length === 4) return ou.headerNameToString(e) === "host"
		if (t && ou.headerNameToString(e).startsWith("content-")) return !0
		if (r && (e.length === 13 || e.length === 6 || e.length === 19)) {
			let n = ou.headerNameToString(e)
			return n === "authorization" || n === "cookie" || n === "proxy-authorization"
		}
		return !1
	}