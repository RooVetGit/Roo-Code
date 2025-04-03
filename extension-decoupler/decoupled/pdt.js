
	var I0e = Ws(),
		Pdt = (e, t, r, n, i) => {
			typeof r == "string" && ((i = n), (n = r), (r = void 0))
			try {
				return new I0e(e instanceof I0e ? e.version : e, r).inc(t, n, i).version
			} catch {
				return null
			}
		}