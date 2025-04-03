
var rpe = x((_Tt, tpe) => {
	"use strict"
	var _H
	function Mat(e) {
		var t = !1
		return function () {
			t || ((t = !0), e.apply(void 0, arguments))
		}
	}
	var epe = _h().codes,
		Fat = epe.ERR_MISSING_ARGS,
		Qat = epe.ERR_STREAM_DESTROYED
	function Zge(e) {
		if (e) throw e
	}
	function Nat(e) {
		return e.setHeader && typeof e.abort == "function"
	}
	function Pat(e, t, r, n) {
		n = Mat(n)
		var i = !1
		e.on("close", function () {
			i = !0
		}),
			_H === void 0 && (_H = sR()),
			_H(e, { readable: t, writable: r }, function (o) {
				if (o) return n(o)
				;(i = !0), n()
			})
		var s = !1
		return function (o) {
			if (!i && !s) {
				if (((s = !0), Nat(e))) return e.abort()
				if (typeof e.destroy == "function") return e.destroy()
				n(o || new Qat("pipe"))
			}
		}
	}
	function Xge(e) {
		e()
	}
	function Lat(e, t) {
		return e.pipe(t)
	}
	function Uat(e) {
		return !e.length || typeof e[e.length - 1] != "function" ? Zge : e.pop()
	}
	function Oat() {
		for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r]
		var n = Uat(t)
		if ((Array.isArray(t[0]) && (t = t[0]), t.length < 2)) throw new Fat("streams")
		var i,
			s = t.map(function (o, a) {
				var l = a < t.length - 1,
					c = a > 0
				return Pat(o, l, c, function (u) {
					i || (i = u), u && s.forEach(Xge), !l && (s.forEach(Xge), n(i))
				})
			})
		return t.reduce(Lat)
	}
	tpe.exports = Oat
})