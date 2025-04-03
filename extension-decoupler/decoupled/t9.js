
				function T9(d) {
					var h = 0,
						A = 0
					return function () {
						var E = oIe(),
							S = q - (E - A)
						if (((A = E), S > 0)) {
							if (++h >= ne) return arguments[0]
						} else h = 0
						return d.apply(e, arguments)
					}
				}