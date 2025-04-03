
	function RT() {
		for (var e = Si.md.sha1.create(), t = arguments.length, r = 0; r < t; ++r) e.update(arguments[r])
		return e.digest()
	}