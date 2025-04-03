
	function Got(e) {
		var t = -1,
			r = e.length
		return function () {
			return ++t < r ? { value: e[t], key: t } : null
		}
	}