
				function i$(d, h) {
					if (d == null) return {}
					var A = Yr(S2(d), function (E) {
						return [E]
					})
					return (
						(h = ct(h)),
						J6(d, A, function (E, S) {
							return h(E, S[0])
						})
					)
				}