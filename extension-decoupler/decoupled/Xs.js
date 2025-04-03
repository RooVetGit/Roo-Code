
	function xs(e, t) {
		Object.defineProperty(vit, e, {
			get() {
				return t()
			},
			configurable: !0,
		})
	}