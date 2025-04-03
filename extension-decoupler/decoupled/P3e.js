
	function P3e(e, t) {
		t === void 0 && (t = {})
		for (let r = 0; r < e.length; r += 2) {
			let n = bee(e[r]),
				i = t[n]
			if (i) typeof i == "string" && ((i = [i]), (t[n] = i)), i.push(e[r + 1].toString("utf8"))
			else {
				let s = e[r + 1]
				typeof s == "string"
					? (t[n] = s)
					: (t[n] = Array.isArray(s) ? s.map((o) => o.toString("utf8")) : s.toString("utf8"))
			}
		}
		return (
			"content-length" in t &&
				"content-disposition" in t &&
				(t["content-disposition"] = Buffer.from(t["content-disposition"]).toString("latin1")),
			t
		)
	}