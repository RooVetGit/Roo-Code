
	function _0(e) {
		return {
			aborted: !1,
			rangeRequested: !1,
			timingAllowPassed: !1,
			requestIncludesCredentials: !1,
			type: "default",
			status: 200,
			timingInfo: null,
			cacheState: "",
			statusText: "",
			...e,
			headersList: e?.headersList ? new cse(e?.headersList) : new cse(),
			urlList: e?.urlList ? [...e.urlList] : [],
		}
	}