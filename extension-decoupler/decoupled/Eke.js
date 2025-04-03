
	function EKe(e, t) {
		let r = e.request,
			n = t.internalResponse ? t.internalResponse : t,
			i
		try {
			if (((i = QYe(n, uu(r).hash)), i == null)) return t
		} catch (o) {
			return Promise.resolve(nn(o))
		}
		if (!PV(i)) return Promise.resolve(nn("URL scheme must be a HTTP(S) scheme"))
		if (r.redirectCount === 20) return Promise.resolve(nn("redirect count exceeded"))
		if (((r.redirectCount += 1), r.mode === "cors" && (i.username || i.password) && !QV(r, i)))
			return Promise.resolve(nn('cross origin not allowed for request mode "cors"'))
		if (r.responseTainting === "cors" && (i.username || i.password))
			return Promise.resolve(nn('URL cannot contain credentials for request mode "cors"'))
		if (n.status !== 303 && r.body != null && r.body.source == null) return Promise.resolve(nn())
		if (([301, 302].includes(n.status) && r.method === "POST") || (n.status === 303 && !AKe.includes(r.method))) {
			;(r.method = "GET"), (r.body = null)
			for (let o of rKe) r.headersList.delete(o)
		}
		QV(uu(r), i) ||
			(r.headersList.delete("authorization", !0),
			r.headersList.delete("proxy-authorization", !0),
			r.headersList.delete("cookie", !0),
			r.headersList.delete("host", !0)),
			r.body != null && (yp(r.body.source != null), (r.body = LV(r.body.source)[0]))
		let s = e.timingInfo
		return (
			(s.redirectEndTime = s.postRedirectStartTime = lb(e.crossOriginIsolatedCapability)),
			s.redirectStartTime === 0 && (s.redirectStartTime = s.startTime),
			r.urlList.push(i),
			NYe(r, n),
			Jse(e, !0)
		)
	}