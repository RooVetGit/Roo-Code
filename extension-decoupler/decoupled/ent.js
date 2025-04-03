
	var wDt = (lr.stylize = function (t, r) {
			if (!lr.enabled) return t + ""
			var n = Mp[r]
			return !n && r in lr ? lr[r](t) : n.open + t + n.close
		}),
		Ent = /[|\\{}()[\]^$+*?.]/g,
		bnt = function (e) {
			if (typeof e != "string") throw new TypeError("Expected a string")
			return e.replace(Ent, "\\$&")
		}