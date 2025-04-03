
	function Ont(e) {
		if (JT.call(e, "circularValue")) {
			let t = e.circularValue
			if (typeof t == "string") return `"${t}"`
			if (t == null) return t
			if (t === Error || t === TypeError)
				return {
					toString() {
						throw new TypeError("Converting circular structure to JSON")
					},
				}
			throw new TypeError('The "circularValue" argument must be of type string or the value null or undefined')
		}
		return '"[Circular]"'
	}