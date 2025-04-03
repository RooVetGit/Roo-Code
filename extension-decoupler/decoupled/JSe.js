
	async function jse(e, t = !1, r = !1) {
		let n = e.request,
			i = null,
			s = null,
			o = null,
			a = null,
			l = !1
		n.window === "no-window" && n.redirect === "error"
			? ((i = e), (s = n))
			: ((s = BYe(n)), (i = { ...e }), (i.request = s))
		let c = n.credentials === "include" || (n.credentials === "same-origin" && n.responseTainting === "basic"),
			u = s.body ? s.body.length : null,
			f = null
		if (
			(s.body == null && ["POST", "PUT"].includes(s.method) && (f = "0"),
			u != null && (f = SD(`${u}`)),
			f != null && s.headersList.append("content-length", f, !0),
			u != null && s.keepalive,
			s.referrer instanceof URL && s.headersList.append("referer", SD(s.referrer.href), !0),
			FYe(s),
			LYe(s),
			s.headersList.contains("user-agent", !0) || s.headersList.append("user-agent", mKe),
			s.cache === "default" &&
				(s.headersList.contains("if-modified-since", !0) ||
					s.headersList.contains("if-none-match", !0) ||
					s.headersList.contains("if-unmodified-since", !0) ||
					s.headersList.contains("if-match", !0) ||
					s.headersList.contains("if-range", !0)) &&
				(s.cache = "no-store"),
			s.cache === "no-cache" &&
				!s.preventNoCacheCacheControlHeaderModification &&
				!s.headersList.contains("cache-control", !0) &&
				s.headersList.append("cache-control", "max-age=0", !0),
			(s.cache === "no-store" || s.cache === "reload") &&
				(s.headersList.contains("pragma", !0) || s.headersList.append("pragma", "no-cache", !0),
				s.headersList.contains("cache-control", !0) || s.headersList.append("cache-control", "no-cache", !0)),
			s.headersList.contains("range", !0) && s.headersList.append("accept-encoding", "identity", !0),
			s.headersList.contains("accept-encoding", !0) ||
				(KYe(uu(s))
					? s.headersList.append("accept-encoding", "br, gzip, deflate", !0)
					: s.headersList.append("accept-encoding", "gzip, deflate", !0)),
			s.headersList.delete("host", !0),
			a == null && (s.cache = "no-store"),
			s.cache !== "no-store" && s.cache,
			o == null)
		) {
			if (s.cache === "only-if-cached") return nn("only if cached")
			let p = await bKe(i, c, r)
			!tKe.has(s.method) && p.status >= 200 && p.status <= 399, l && p.status, o == null && (o = p)
		}
		if (
			((o.urlList = [...s.urlList]),
			s.headersList.contains("range", !0) && (o.rangeRequested = !0),
			(o.requestIncludesCredentials = c),
			o.status === 407)
		)
			return n.window === "no-window" ? nn() : mp(e) ? wD(e) : nn("proxy authentication required")
		if (o.status === 421 && !r && (n.body == null || n.body.source != null)) {
			if (mp(e)) return wD(e)
			e.controller.connection.destroy(), (o = await jse(e, t, !0))
		}
		return o
	}