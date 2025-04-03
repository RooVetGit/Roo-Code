
				function Y9(d, h, A) {
					var E,
						S,
						P,
						U,
						H,
						Z,
						ce = 0,
						ue = !1,
						Ae = !1,
						Te = !0
					if (typeof d != "function") throw new Va(i)
					;(h = Ya(h) || 0),
						Un(A) &&
							((ue = !!A.leading),
							(Ae = "maxWait" in A),
							(P = Ae ? Pi(Ya(A.maxWait) || 0, h) : P),
							(Te = "trailing" in A ? !!A.trailing : Te))
					function Ge(fi) {
						var $l = E,
							fd = S
						return (E = S = e), (ce = fi), (U = d.apply(fd, $l)), U
					}
					function dt(fi) {
						return (ce = fi), (H = vv(nr, h)), ue ? Ge(fi) : U
					}
					function Gt(fi) {
						var $l = fi - Z,
							fd = fi - ce,
							f$ = h - $l
						return Ae ? Rs(f$, P - fd) : f$
					}
					function ft(fi) {
						var $l = fi - Z,
							fd = fi - ce
						return Z === e || $l >= h || $l < 0 || (Ae && fd >= P)
					}
					function nr() {
						var fi = tI()
						if (ft(fi)) return yr(fi)
						H = vv(nr, Gt(fi))
					}
					function yr(fi) {
						return (H = e), Te && E ? Ge(fi) : ((E = S = e), U)
					}
					function la() {
						H !== e && n9(H), (ce = 0), (E = Z = S = H = e)
					}
					function to() {
						return H === e ? U : yr(tI())
					}
					function ca() {
						var fi = tI(),
							$l = ft(fi)
						if (((E = arguments), (S = this), (Z = fi), $l)) {
							if (H === e) return dt(Z)
							if (Ae) return n9(H), (H = vv(nr, h)), Ge(Z)
						}
						return H === e && (H = vv(nr, h)), U
					}
					return (ca.cancel = la), (ca.flush = to), ca
				}