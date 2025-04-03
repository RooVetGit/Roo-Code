
	function $se(e, t = "other") {
		if ((e.type === "error" && e.aborted) || !e.urlList?.length) return
		let r = e.urlList[0],
			n = e.timingInfo,
			i = e.cacheState
		PV(r) &&
			n !== null &&
			(e.timingAllowPassed || ((n = NV({ startTime: n.startTime })), (i = "")),
			(n.endTime = lb()),
			(e.timingInfo = n),
			Yse(n, r.href, t, globalThis, i))
	}