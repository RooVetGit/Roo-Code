
				function IIe(d, h) {
					var A = this.__data__,
						E = Uw(A, d)
					return E < 0 ? (++this.size, A.push([d, h])) : (A[E][1] = h), this
				}