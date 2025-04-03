
	function UOe(e) {
		var t = typeof e
		return t == "string" || t == "number" || t == "symbol" || t == "boolean" ? e !== "__proto__" : e === null
	}