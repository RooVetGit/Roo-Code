
	function M6e(e) {
		if (e && Object.keys(e).find((r) => r.toLowerCase() === "proxy-authorization"))
			throw new eD("Proxy-Authorization should be sent in ProxyAgent constructor")
	}