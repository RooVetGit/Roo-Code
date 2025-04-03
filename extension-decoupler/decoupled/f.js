
				function F(d) {
					if (jn(d) && !Rt(d) && !(d instanceof ur)) {
						if (d instanceof Ha) return d
						if (tn.call(d, "__wrapped__")) return k9(d)
					}
					return new Ha(d)
				}