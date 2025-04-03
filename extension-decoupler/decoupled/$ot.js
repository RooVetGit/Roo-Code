
	function $ot(e) {
		var t = -1
		return function () {
			var n = e.next()
			return n.done ? null : (t++, { value: n.value, key: t })
		}
	}