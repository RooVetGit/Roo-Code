
	function Xj(e, t) {
		return (
			e.getElementsByTagName &&
			t.some(function (r) {
				return e.getElementsByTagName(r).length
			})
		)
	}