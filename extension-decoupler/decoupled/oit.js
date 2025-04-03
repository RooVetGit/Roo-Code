
	function Oit(e) {
		var t = Uit(e)
		if (typeof t != "string" && (Z3.isEncoding === Dhe || !Dhe(e))) throw new Error("Unknown encoding: " + e)
		return t || e
	}