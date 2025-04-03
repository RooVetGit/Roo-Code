
	function U9e(e, t, r) {
		let n = { timesInvoked: 0, times: 1, persist: !1, consumed: !1 },
			i = typeof r == "function" ? { callback: r } : { ...r },
			s = { ...n, ...t, pending: !0, data: { error: null, ...i } }
		return e.push(s), s
	}