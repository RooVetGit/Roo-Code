
	function X3e(e) {
		if (e == null || e === "") return { start: 0, end: null, size: null }
		let t = e ? e.match(/^bytes (\d+)-(\d+)\/(\d+)?$/) : null
		return t
			? {
					start: parseInt(t[1]),
					end: t[2] ? parseInt(t[2]) : null,
					size: t[3] ? parseInt(t[3]) : null,
				}
			: null
	}