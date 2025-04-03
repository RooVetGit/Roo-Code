
	function Nhe(e, t, r, n, i, s, o) {
		try {
			var a = e[s](o),
				l = a.value
		} catch (c) {
			r(c)
			return
		}
		a.done ? t(l) : Promise.resolve(l).then(n, i)
	}