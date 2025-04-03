
	function mse(e, t) {
		if (t === "basic") return pD(e, { type: "basic", headersList: e.headersList })
		if (t === "cors") return pD(e, { type: "cors", headersList: e.headersList })
		if (t === "opaque")
			return pD(e, {
				type: "opaque",
				urlList: Object.freeze([]),
				status: 0,
				statusText: "",
				body: null,
			})
		if (t === "opaqueredirect")
			return pD(e, {
				type: "opaqueredirect",
				status: 0,
				statusText: "",
				headersList: [],
				body: null,
			})
		wV(!1)
	}