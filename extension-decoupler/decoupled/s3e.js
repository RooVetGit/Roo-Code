
	function S3e(e, t) {
		if (e.includes("?") || e.includes("#"))
			throw new Error('Query params cannot be passed when url already contains "?" or "#".')
		let r = v3e(t)
		return r && (e += "?" + r), e
	}