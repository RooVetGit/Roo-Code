
	function wnt() {
		var e = {}
		return (
			Object.keys(ffe).forEach(function (t) {
				e[t] = {
					get: function () {
						return dfe([t])
					},
				}
			}),
			e
		)
	}