
	function _nt() {
		var e = Array.prototype.slice.call(arguments),
			t = e
				.map(function (o) {
					return o != null && o.constructor === String ? o : Cnt.inspect(o)
				})
				.join(" ")
		if (!lr.enabled || !t) return t
		for (
			var r =
					t.indexOf(`
`) != -1,
				n = this._styles,
				i = n.length;
			i--;

		) {
			var s = Mp[n[i]]
			;(t = s.open + t.replace(s.closeRe, s.open) + s.close),
				r &&
					(t = t.replace(vnt, function (o) {
						return s.close + o + s.open
					}))
		}
		return t
	}