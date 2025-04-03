
				function R2(d, h) {
					if (Rt(d)) return !1
					var A = typeof d
					return A == "number" || A == "symbol" || A == "boolean" || d == null || aa(d)
						? !0
						: FN.test(d) || !SA.test(d) || (h != null && d in cn(h))
				}