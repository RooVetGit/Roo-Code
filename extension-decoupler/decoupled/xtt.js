
	var Ztt = gd(),
		yde = Object.create,
		Xtt = (function () {
			function e() {}
			return function (t) {
				if (!Ztt(t)) return {}
				if (yde) return yde(t)
				e.prototype = t
				var r = new e()
				return (e.prototype = void 0), r
			}
		})()