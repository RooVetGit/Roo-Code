
	function hse(e, t, r) {
		if (t.status !== null && (t.status < 200 || t.status > 599))
			throw new RangeError('init["status"] must be in the range of 200 to 599, inclusive.')
		if ("statusText" in t && t.statusText != null && !W$e(String(t.statusText)))
			throw new TypeError("Invalid statusText")
		if (
			("status" in t && t.status != null && (e[ni].status = t.status),
			"statusText" in t && t.statusText != null && (e[ni].statusText = t.statusText),
			"headers" in t && t.headers != null && P$e(e[Md], t.headers),
			r)
		) {
			if (X$e.includes(e.status))
				throw Ht.errors.exception({
					header: "Response constructor",
					message: `Invalid response status code ${e.status}`,
				})
			;(e[ni].body = r.body),
				r.type != null &&
					!e[ni].headersList.contains("content-type", !0) &&
					e[ni].headersList.append("content-type", r.type, !0)
		}
	}