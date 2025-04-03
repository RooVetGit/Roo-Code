
	function Fit(e, t) {
		if (typeof e != "object" || e === null) return e
		var r = e[Symbol.toPrimitive]
		if (r !== void 0) {
			var n = r.call(e, t || "default")
			if (typeof n != "object") return n
			throw new TypeError("@@toPrimitive must return a primitive value.")
		}
		return (t === "string" ? String : Number)(e)
	}