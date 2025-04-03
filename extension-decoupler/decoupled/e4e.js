
	async function e4e(e, t, r) {
		let n = t,
			i = r,
			s
		try {
			s = e.stream.getReader()
		} catch (o) {
			i(o)
			return
		}
		try {
			n(await wte(s))
		} catch (o) {
			i(o)
		}
	}