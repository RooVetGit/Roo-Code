
				function $2(d, h, A) {
					var E = $i(h),
						S = qw(h, E)
					A == null &&
						!(Un(h) && (S.length || !E.length)) &&
						((A = h), (h = d), (d = this), (S = qw(h, $i(h))))
					var P = !(Un(A) && "chain" in A) || !!A.chain,
						U = ud(d)
					return (
						ds(S, function (H) {
							var Z = h[H]
							;(d[H] = Z),
								U &&
									(d.prototype[H] = function () {
										var ce = this.__chain__
										if (P || ce) {
											var ue = d(this.__wrapped__),
												Ae = (ue.__actions__ = wo(this.__actions__))
											return (
												Ae.push({ func: Z, args: arguments, thisArg: d }),
												(ue.__chain__ = ce),
												ue
											)
										}
										return Z.apply(d, js([this.value()], arguments))
									})
						}),
						d
					)
				}