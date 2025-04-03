
var jT = x((WDt, Hfe) => {
	"use strict"
	var ty = 1e3,
		ry = ty * 60,
		ny = ry * 60,
		Np = ny * 24,
		eit = Np * 7,
		tit = Np * 365.25
	Hfe.exports = function (e, t) {
		t = t || {}
		var r = typeof e
		if (r === "string" && e.length > 0) return rit(e)
		if (r === "number" && isFinite(e)) return t.long ? iit(e) : nit(e)
		throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(e))
	}
	function rit(e) {
		if (((e = String(e)), !(e.length > 100))) {
			var t =
				/^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
					e,
				)
			if (t) {
				var r = parseFloat(t[1]),
					n = (t[2] || "ms").toLowerCase()
				switch (n) {
					case "years":
					case "year":
					case "yrs":
					case "yr":
					case "y":
						return r * tit
					case "weeks":
					case "week":
					case "w":
						return r * eit
					case "days":
					case "day":
					case "d":
						return r * Np
					case "hours":
					case "hour":
					case "hrs":
					case "hr":
					case "h":
						return r * ny
					case "minutes":
					case "minute":
					case "mins":
					case "min":
					case "m":
						return r * ry
					case "seconds":
					case "second":
					case "secs":
					case "sec":
					case "s":
						return r * ty
					case "milliseconds":
					case "millisecond":
					case "msecs":
					case "msec":
					case "ms":
						return r
					default:
						return
				}
			}
		}
	}
	function nit(e) {
		var t = Math.abs(e)
		return t >= Np
			? Math.round(e / Np) + "d"
			: t >= ny
				? Math.round(e / ny) + "h"
				: t >= ry
					? Math.round(e / ry) + "m"
					: t >= ty
						? Math.round(e / ty) + "s"
						: e + "ms"
	}
	function iit(e) {
		var t = Math.abs(e)
		return t >= Np
			? zT(e, t, Np, "day")
			: t >= ny
				? zT(e, t, ny, "hour")
				: t >= ry
					? zT(e, t, ry, "minute")
					: t >= ty
						? zT(e, t, ty, "second")
						: e + " ms"
	}
	function zT(e, t, r, n) {
		var i = t >= r * 1.5
		return Math.round(e / r) + " " + n + (i ? "s" : "")
	}
})