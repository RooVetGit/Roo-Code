
	function _He({ allowH2: e, maxCachedSessions: t, socketPath: r, timeout: n, session: i, ...s }) {
		if (t != null && (!Number.isInteger(t) || t < 0))
			throw new bHe("maxCachedSessions must be a positive integer or zero")
		let o = { path: r, ...s },
			a = new BO(t ?? 100)
		return (
			(n = n ?? 1e4),
			(e = e ?? !1),
			function (
				{ hostname: c, host: u, protocol: f, port: p, servername: g, localAddress: m, httpSocket: y },
				C,
			) {
				let v
				if (f === "https:") {
					SO || (SO = require("tls")), (g = g || o.servername || Gee.getServerName(u) || null)
					let w = g || c
					Vee(w)
					let B = i || a.get(w) || null
					;(p = p || 443),
						(v = SO.connect({
							highWaterMark: 16384,
							...o,
							servername: g,
							session: B,
							localAddress: m,
							ALPNProtocols: e ? ["http/1.1", "h2"] : ["http/1.1"],
							socket: y,
							port: p,
							host: c,
						})),
						v.on("session", function (M) {
							a.set(w, M)
						})
				} else
					Vee(!y, "httpSocket can only be sent on TLS update"),
						(p = p || 80),
						(v = EHe.connect({
							highWaterMark: 64 * 1024,
							...o,
							localAddress: m,
							port: p,
							host: c,
						}))
				if (o.keepAlive == null || o.keepAlive) {
					let w = o.keepAliveInitialDelay === void 0 ? 6e4 : o.keepAliveInitialDelay
					v.setKeepAlive(!0, w)
				}
				let b = wHe(new WeakRef(v), { timeout: n, hostname: c, port: p })
				return (
					v
						.setNoDelay(!0)
						.once(f === "https:" ? "secureConnect" : "connect", function () {
							if ((queueMicrotask(b), C)) {
								let w = C
								;(C = null), w(null, this)
							}
						})
						.on("error", function (w) {
							if ((queueMicrotask(b), C)) {
								let B = C
								;(C = null), B(w)
							}
						}),
					v
				)
			}
		)
	}