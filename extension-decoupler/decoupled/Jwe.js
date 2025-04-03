
	function jWe(e) {
		let t = JSON.stringify(e)
		if (t === void 0) throw new TypeError("Value is not JSON serializable")
		return ip(typeof t == "string"), t
	}