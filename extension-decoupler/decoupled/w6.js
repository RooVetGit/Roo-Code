
				function W6(d, h) {
					var A = -1,
						E = Io(d) ? ie(d.length) : []
					return (
						_f(d, function (S, P, U) {
							E[++A] = h(S, P, U)
						}),
						E
					)
				}