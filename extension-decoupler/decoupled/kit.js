
	function Kit(e, t) {
		var r = (e.length - t) % 3
		return r === 0
			? e.toString("base64", t)
			: ((this.lastNeed = 3 - r),
				(this.lastTotal = 3),
				r === 1
					? (this.lastChar[0] = e[e.length - 1])
					: ((this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1])),
				e.toString("base64", t, e.length - r))
	}