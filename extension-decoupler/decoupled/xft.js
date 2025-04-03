
	var Xft = Ws(),
		eht = bl(),
		tht = (e, t, r) => {
			let n = null,
				i = null,
				s = null
			try {
				s = new eht(t, r)
			} catch {
				return null
			}
			return (
				e.forEach((o) => {
					s.test(o) && (!n || i.compare(o) === 1) && ((n = o), (i = new Xft(n, r)))
				}),
				n
			)
		}