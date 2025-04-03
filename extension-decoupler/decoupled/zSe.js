
	async function zse(e) {
		let t = e.request,
			r = null,
			n = null,
			i = e.timingInfo
		if ((t.serviceWorkers, r === null)) {
			if (
				(t.redirect === "follow" && (t.serviceWorkers = "none"),
				(n = r = await jse(e)),
				t.responseTainting === "cors" && UYe(t, r) === "failure")
			)
				return nn("cors failure")
			MYe(t, r) === "failure" && (t.timingAllowFailed = !0)
		}
		return (t.responseTainting === "opaque" || r.type === "opaque") &&
			OYe(t.origin, t.client, t.destination, n) === "blocked"
			? nn("blocked")
			: (Wse.has(n.status) &&
					(t.redirect !== "manual" && e.controller.connection.destroy(void 0, !1),
					t.redirect === "error"
						? (r = nn("unexpected redirect"))
						: t.redirect === "manual"
							? (r = n)
							: t.redirect === "follow"
								? (r = await EKe(e, r))
								: yp(!1)),
				(r.timingInfo = i),
				r)
	}