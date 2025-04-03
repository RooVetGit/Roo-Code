
	function Iot(e) {
		return (0, wot.isAsync)(e)
			? function (...t) {
					let r = t.pop(),
						n = e.apply(this, t)
					return mge(n, r)
				}
			: (0, bot.default)(function (t, r) {
					var n
					try {
						n = e.apply(this, t)
					} catch (i) {
						return r(i)
					}
					if (n && typeof n.then == "function") return mge(n, r)
					r(null, n)
				})
	}