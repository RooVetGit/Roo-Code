
	function Oot(e) {
		function t(...r) {
			if (e !== null) {
				var n = e
				;(e = null), n.apply(this, r)
			}
		}
		return Object.assign(t, e), t
	}