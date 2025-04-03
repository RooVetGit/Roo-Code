
				function X9(d) {
					if (!d) return []
					if (Io(d)) return sI(d) ? Hl(d) : wo(d)
					if (lv && d[lv]) return Uwe(d[lv]())
					var h = ks(d),
						A = h == be ? t2 : h == Ei ? _w : KA
					return A(d)
				}