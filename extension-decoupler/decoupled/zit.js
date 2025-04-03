
	function Zit(e) {
		var t = !1
		return function () {
			if (!t) {
				t = !0
				for (var r = arguments.length, n = new Array(r), i = 0; i < r; i++) n[i] = arguments[i]
				e.apply(this, n)
			}
		}
	}