
	var $ft = bl(),
		Yft = (e, t, r) => {
			try {
				t = new $ft(t, r)
			} catch {
				return !1
			}
			return t.test(e)
		}