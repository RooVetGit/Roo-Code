
				function RIe(d, h) {
					var A = jw(this, d),
						E = A.size
					return A.set(d, h), (this.size += A.size == E ? 0 : 1), this
				}