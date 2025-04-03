
var II = (e) => {
		let { data: t, path: r, errorMaps: n, issueData: i } = e,
			s = [...r, ...(i.path || [])],
			o = { ...i, path: s }
		if (i.message !== void 0) return { ...i, path: s, message: i.message }
		let a = "",
			l = n
				.filter((c) => !!c)
				.slice()
				.reverse()
		for (let c of l) a = c(o, { data: t, defaultError: a }).message
		return { ...i, path: s, message: a }
	},
	wMe = []