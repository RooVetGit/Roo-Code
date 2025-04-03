
				function H9(d, h) {
					var A
					if (typeof h != "function") throw new Va(i)
					return (
						(d = Vt(d)),
						function () {
							return --d > 0 && (A = h.apply(this, arguments)), d <= 1 && (h = e), A
						}
					)
				}