
	function die(e, t) {
		if (Array.isArray(e)) {
			for (let r = 0; r < e.length; r += 2)
				if (e[r].toLocaleLowerCase() === t.toLocaleLowerCase()) return e[r + 1]
			return
		} else return typeof e.get == "function" ? e.get(t) : uie(e)[t.toLocaleLowerCase()]
	}