
	function Kse({
		request: e,
		processRequestBodyChunkLength: t,
		processRequestEndOfBody: r,
		processResponse: n,
		processResponseEndOfBody: i,
		processResponseConsumeBody: s,
		useParallelQueue: o = !1,
		dispatcher: a = hKe(),
	}) {
		yp(a)
		let l = null,
			c = !1
		e.client != null && ((l = e.client.globalObject), (c = e.client.crossOriginIsolatedCapability))
		let u = lb(c),
			f = NV({ startTime: u }),
			p = {
				controller: new DD(a),
				request: e,
				timingInfo: f,
				processRequestBodyChunkLength: t,
				processRequestEndOfBody: r,
				processResponse: n,
				processResponseConsumeBody: s,
				processResponseEndOfBody: i,
				taskDestination: l,
				crossOriginIsolatedCapability: c,
			}
		if (
			(yp(!e.body || e.body.stream),
			e.window === "client" &&
				(e.window = e.client?.globalObject?.constructor?.name === "Window" ? e.client : "no-window"),
			e.origin === "client" && (e.origin = e.client.origin),
			e.policyContainer === "client" &&
				(e.client != null ? (e.policyContainer = RYe(e.client.policyContainer)) : (e.policyContainer = TYe())),
			!e.headersList.contains("accept", !0))
		) {
			let g = "*/*"
			e.headersList.append("accept", g, !0)
		}
		return (
			e.headersList.contains("accept-language", !0) || e.headersList.append("accept-language", "*", !0),
			e.priority,
			nKe.has(e.destination),
			Jse(p).catch((g) => {
				p.controller.terminate(g)
			}),
			p.controller
		)
	}