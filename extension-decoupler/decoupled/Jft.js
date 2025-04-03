
	var zft = Ws(),
		jft = bl(),
		Zft = (e, t, r) => {
			let n = null,
				i = null,
				s = null
			try {
				s = new jft(t, r)
			} catch {
				return null
			}
			return (
				e.forEach((o) => {
					s.test(o) && (!n || i.compare(o) === -1) && ((n = o), (i = new zft(n, r)))
				}),
				n
			)
		}