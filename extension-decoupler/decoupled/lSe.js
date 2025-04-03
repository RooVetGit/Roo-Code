
				function LSe(d, h) {
					var A = d[1],
						E = h[1],
						S = A | E,
						P = S < (m | y | M),
						U =
							(E == M && A == v) ||
							(E == M && A == Q && d[7].length <= h[8]) ||
							(E == (M | Q) && h[7].length <= h[8] && A == v)
					if (!(P || U)) return d
					E & m && ((d[2] = h[2]), (S |= A & m ? 0 : C))
					var H = h[3]
					if (H) {
						var Z = d[3]
						;(d[3] = Z ? a9(Z, H, h[4]) : H), (d[4] = Z ? Ef(d[3], l) : h[4])
					}
					return (
						(H = h[5]),
						H && ((Z = d[5]), (d[5] = Z ? l9(Z, H, h[6]) : H), (d[6] = Z ? Ef(d[5], l) : h[6])),
						(H = h[7]),
						H && (d[7] = H),
						E & M && (d[8] = d[8] == null ? h[8] : Rs(d[8], h[8])),
						d[9] == null && (d[9] = h[9]),
						(d[0] = h[0]),
						(d[1] = S),
						d
					)
				}