
	function Bst(e, t) {
		var r
		return (
			!Cst(t) &&
				typeof t != "string" &&
				t !== void 0 &&
				!e.objectMode &&
				(r = new xst("chunk", ["string", "Buffer", "Uint8Array"], t)),
			r
		)
	}