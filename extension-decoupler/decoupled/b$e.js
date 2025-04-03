
	function B$e({ maxSize: e } = { maxSize: 1024 * 1024 }) {
		return (t) =>
			function (n, i) {
				let { dumpMaxSize: s = e } = n,
					o = new yV({ maxSize: s }, i)
				return t(n, o)
			}
	}