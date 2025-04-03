
	function UZe() {
		return {
			nextBytes: function (e) {
				for (var t = 0; t < e.length; ++t) e[t] = Math.floor(Math.random() * 256)
			},
		}
	}