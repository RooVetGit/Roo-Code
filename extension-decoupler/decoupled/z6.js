
				function Z6(d, h) {
					for (var A = -1, E = d.length, S = 0, P = []; ++A < E; ) {
						var U = d[A],
							H = h ? h(U) : U
						if (!A || !Gl(H, Z)) {
							var Z = H
							P[S++] = U === 0 ? 0 : U
						}
					}
					return P
				}