
	function Yot(e) {
		var t = e ? Object.keys(e) : [],
			r = -1,
			n = t.length
		return function i() {
			var s = t[++r]
			return s === "__proto__" ? i() : r < n ? { value: e[s], key: s } : null
		}
	}