
	var dlt = RH(),
		flt = require("tty").isatty(1),
		OR = dlt(function e(t, r) {
			return (
				(r = r || {}),
				(r.colors = "colors" in r ? r.colors : flt),
				(r.namespace = t),
				(r.prod = !1),
				(r.dev = !0),
				!e.enabled(t) && !(r.force || e.force) ? e.nope(r) : e.yep(r)
			)
		})