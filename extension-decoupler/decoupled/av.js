
				function Av(d, h, A, E, S) {
					return d === h
						? !0
						: d == null || h == null || (!jn(d) && !jn(h))
							? d !== d && h !== h
							: ZIe(d, h, A, E, Av, S)
				}