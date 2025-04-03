
	function q9e() {
		let e = this[R9e],
			t = this[M9e],
			r = this[k9e]
		return function (i, s) {
			if (e.isMockActive)
				try {
					mie.call(this, i, s)
				} catch (o) {
					if (o instanceof fp) {
						let a = e[F9e]()
						if (a === !1)
							throw new fp(
								`${o.message}: subsequent request to origin ${t} was not allowed (net.connect disabled)`,
							)
						if (yie(a, t)) r.call(this, i, s)
						else
							throw new fp(
								`${o.message}: subsequent request to origin ${t} was not allowed (net.connect is not enabled for this origin)`,
							)
					} else throw o
				}
			else r.call(this, i, s)
		}
	}