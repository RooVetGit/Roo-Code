
	function L3e(e) {
		let t = e.length,
			r = new Array(t),
			n = !1,
			i = -1,
			s,
			o,
			a = 0
		for (let l = 0; l < e.length; l += 2)
			(s = e[l]),
				(o = e[l + 1]),
				typeof s != "string" && (s = s.toString()),
				typeof o != "string" && (o = o.toString("utf8")),
				(a = s.length),
				a === 14 && s[7] === "-" && (s === "content-length" || s.toLowerCase() === "content-length")
					? (n = !0)
					: a === 19 &&
						s[7] === "-" &&
						(s === "content-disposition" || s.toLowerCase() === "content-disposition") &&
						(i = l + 1),
				(r[l] = s),
				(r[l + 1] = o)
		return n && i !== -1 && (r[i] = Buffer.from(r[i]).toString("latin1")), r
	}