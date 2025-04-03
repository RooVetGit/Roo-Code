
				function N2(d) {
					if (!(d && d.length)) return []
					var h = 0
					return (
						(d = qa(d, function (A) {
							if (di(A)) return (h = Pi(A.length, h)), !0
						})),
						ln(h, function (A) {
							return Yr(d, te(A))
						})
					)
				}