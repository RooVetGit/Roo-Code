
	function Ehe(e) {
		for (var t = 1; t < arguments.length; t++) {
			var r = arguments[t] != null ? arguments[t] : {}
			t % 2
				? vhe(Object(r), !0).forEach(function (n) {
						Rit(e, n, r[n])
					})
				: Object.getOwnPropertyDescriptors
					? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r))
					: vhe(Object(r)).forEach(function (n) {
							Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n))
						})
		}
		return e
	}