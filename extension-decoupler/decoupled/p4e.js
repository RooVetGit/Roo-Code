
	function p4e(e) {
		return (
			e instanceof g4e ||
			(e &&
				(typeof e.stream == "function" || typeof e.arrayBuffer == "function") &&
				e[Symbol.toStringTag] === "File")
		)
	}