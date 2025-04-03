
	function Pnt(e) {
		if (typeof e.transform != "function")
			throw new Error(
				[
					"No transform function found on format. Did you create a format instance?",
					"const myFormat = format(formatFn);",
					"const instance = myFormat();",
				].join(`
`),
			)
		return !0
	}