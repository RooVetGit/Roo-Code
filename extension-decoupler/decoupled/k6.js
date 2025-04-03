
				function K6(d, h, A) {
					h.length
						? (h = Yr(h, function (P) {
								return Rt(P)
									? function (U) {
											return Cg(U, P.length === 1 ? P[0] : P)
										}
									: P
							}))
						: (h = [Bo])
					var E = -1
					h = Yr(h, En(ct()))
					var S = W6(d, function (P, U, H) {
						var Z = Yr(h, function (ce) {
							return ce(P)
						})
						return { criteria: Z, index: ++E, value: P }
					})
					return st(S, function (P, U) {
						return mSe(P, U, A)
					})
				}