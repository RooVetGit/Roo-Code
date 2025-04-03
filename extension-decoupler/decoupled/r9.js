
				var R9 = PSe(function (d) {
					var h = []
					return (
						d.charCodeAt(0) === 46 && h.push(""),
						d.replace($C, function (A, E, S, P) {
							h.push(S ? P.replace(Uc, "$1") : E || A)
						}),
						h
					)
				})