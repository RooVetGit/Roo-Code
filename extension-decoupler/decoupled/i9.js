
				function I9(d, h, A) {
					return (
						(h = Pi(h === e ? d.length - 1 : h, 0)),
						function () {
							for (var E = arguments, S = -1, P = Pi(E.length - h, 0), U = ie(P); ++S < P; )
								U[S] = E[h + S]
							S = -1
							for (var H = ie(h + 1); ++S < h; ) H[S] = E[S]
							return (H[h] = A(U)), us(d, this, H)
						}
					)
				}