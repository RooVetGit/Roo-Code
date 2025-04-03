
	function G3e(e) {
		return (
			e &&
			typeof e == "object" &&
			typeof e.append == "function" &&
			typeof e.delete == "function" &&
			typeof e.get == "function" &&
			typeof e.getAll == "function" &&
			typeof e.has == "function" &&
			typeof e.set == "function" &&
			e[Symbol.toStringTag] === "FormData"
		)
	}