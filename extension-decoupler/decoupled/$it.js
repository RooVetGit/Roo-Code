
	function $it(e, t) {
		if ((e.length - t) % 2 === 0) {
			var r = e.toString("utf16le", t)
			if (r) {
				var n = r.charCodeAt(r.length - 1)
				if (n >= 55296 && n <= 56319)
					return (
						(this.lastNeed = 2),
						(this.lastTotal = 4),
						(this.lastChar[0] = e[e.length - 2]),
						(this.lastChar[1] = e[e.length - 1]),
						r.slice(0, -1)
					)
			}
			return r
		}
		return (
			(this.lastNeed = 1),
			(this.lastTotal = 2),
			(this.lastChar[0] = e[e.length - 1]),
			e.toString("utf16le", t, e.length - 1)
		)
	}