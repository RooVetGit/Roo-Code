
	function Vse(e) {
		if (mp(e) && e.request.redirectCount === 0) return Promise.resolve(wD(e))
		let { request: t } = e,
			{ protocol: r } = uu(t)
		switch (r) {
			case "about:":
				return Promise.resolve(nn("about scheme is not supported"))
			case "blob:": {
				kV || (kV = require("buffer").resolveObjectURL)
				let n = uu(t)
				if (n.search.length !== 0) return Promise.resolve(nn("NetworkError when attempting to fetch resource."))
				let i = kV(n.toString())
				if (t.method !== "GET" || !HYe(i)) return Promise.resolve(nn("invalid method"))
				let s = ID(),
					o = i.size,
					a = SD(`${o}`),
					l = i.type
				if (t.headersList.contains("range", !0)) {
					s.rangeRequested = !0
					let c = t.headersList.get("range", !0),
						u = zYe(c, !0)
					if (u === "failure") return Promise.resolve(nn("failed to fetch the data URL"))
					let { rangeStartValue: f, rangeEndValue: p } = u
					if (f === null) (f = o - p), (p = f + p - 1)
					else {
						if (f >= o) return Promise.resolve(nn("Range start is greater than the blob's size."))
						;(p === null || p >= o) && (p = o - 1)
					}
					let g = i.slice(f, p, l),
						m = Ose(g)
					s.body = m[0]
					let y = SD(`${g.size}`),
						C = jYe(f, p, o)
					;(s.status = 206),
						(s.statusText = "Partial Content"),
						s.headersList.set("content-length", y, !0),
						s.headersList.set("content-type", l, !0),
						s.headersList.set("content-range", C, !0)
				} else {
					let c = Ose(i)
					;(s.statusText = "OK"),
						(s.body = c[0]),
						s.headersList.set("content-length", a, !0),
						s.headersList.set("content-type", l, !0)
				}
				return Promise.resolve(s)
			}
			case "data:": {
				let n = uu(t),
					i = uKe(n)
				if (i === "failure") return Promise.resolve(nn("failed to fetch the data URL"))
				let s = dKe(i.mimeType)
				return Promise.resolve(
					ID({
						statusText: "OK",
						headersList: [["content-type", { name: "Content-Type", value: s }]],
						body: LV(i.body)[0],
					}),
				)
			}
			case "file:":
				return Promise.resolve(nn("not implemented... yet..."))
			case "http:":
			case "https:":
				return zse(e).catch((n) => nn(n))
			default:
				return Promise.resolve(nn("unknown scheme"))
		}
	}