
				function HTe(d, h, A) {
					if (
						(A && typeof A != "boolean" && eo(d, h, A) && (h = A = e),
						A === e &&
							(typeof h == "boolean" ? ((A = h), (h = e)) : typeof d == "boolean" && ((A = d), (d = e))),
						d === e && h === e
							? ((d = 0), (h = 1))
							: ((d = dd(d)), h === e ? ((h = d), (d = 0)) : (h = dd(h))),
						d > h)
					) {
						var E = d
						;(d = h), (h = E)
					}
					if (A || d % 1 || h % 1) {
						var S = T6()
						return Rs(d + S * (h - d + ZN("1e-" + ((S + "").length - 1))), h)
					}
					return A2(d, h)
				}