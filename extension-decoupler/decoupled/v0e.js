
	var v0e = Ws(),
		kdt = (e, t, r = !1) => {
			if (e instanceof v0e) return e
			try {
				return new v0e(e, t)
			} catch (n) {
				if (!r) return null
				throw n
			}
		}